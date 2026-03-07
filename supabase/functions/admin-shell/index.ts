import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

type JsonMap = Record<string, unknown>;

type CommandParseResult = {
  raw: string;
  normalized: string;
  tokens: string[];
  positionals: string[];
  flags: Record<string, string>;
};

type ShellTenantContext = {
  id: string;
  slug: string;
  name: string;
};

type ShellSessionRow = {
  id: string;
  tenant_id: string | null;
  status: string;
  title?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string | null;
  updated_at: string | null;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHELL_FUNCTION = "admin-shell";
const MAX_OUTPUT_LINES_PER_WRITE = 120;
const MAX_HISTORY_LIMIT = 400;
const COMMAND_SELECT_FIELDS =
  "id, session_id, command_text, status, cancel_requested, exit_code, error_text, created_at, started_at, finished_at, updated_at";

const SHORT_FLAG_MAP: Record<string, string> = {
  n: "limit",
  l: "limit",
  s: "search",
  q: "search",
  t: "tenant",
  h: "help",
};

const RESOURCE_ALIASES: Record<string, string> = {
  ten: "ten",
  tenant: "ten",
  tenants: "ten",
  t: "ten",
  mem: "mem",
  member: "mem",
  members: "mem",
  m: "mem",
  prj: "prj",
  project: "prj",
  projects: "prj",
  p: "prj",
  fin: "fin",
  finance: "fin",
  finances: "fin",
  f: "fin",
  doc: "doc",
  docs: "doc",
  document: "doc",
  documents: "doc",
  log: "log",
  logs: "log",
  sys: "sys",
  system: "sys",
};

const VERB_ALIASES: Record<string, string> = {
  ls: "ls",
  list: "ls",
  show: "show",
  overview: "show",
  stat: "stat",
  stats: "stat",
  status: "status",
  tail: "tail",
  pause: "pause",
  suspend: "pause",
  resume: "resume",
  reactivate: "resume",
  rm: "rm",
  remove: "rm",
  delete: "rm",
  search: "search",
};

const HELPABLE_RESOURCES = new Set(["ten", "mem", "prj", "fin", "doc", "log", "sys"]);

const BASE_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

class CancelledCommandError extends Error {
  constructor() {
    super("Command cancelled.");
    this.name = "CancelledCommandError";
  }
}

const toText = (value: unknown) => String(value ?? "").trim();

const toLowerText = (value: unknown) => toText(value).toLowerCase();

const isUuid = (value: unknown) => UUID_RE.test(toText(value));

const clampInt = (
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
): number => {
  const parsed = Number.parseInt(toText(value), 10);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.max(minimum, Math.min(maximum, parsed));
};

const json = (status: number, payload: JsonMap) =>
  new Response(JSON.stringify(payload), { status, headers: BASE_HEADERS });

const formatDate = (value: unknown) => {
  const timestamp = Date.parse(toText(value));
  if (!Number.isFinite(timestamp)) return "-";
  return new Date(timestamp).toISOString();
};

const getErrorMessage = (error: unknown, fallback = "Unexpected error.") => {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim()) return error.trim();
  return fallback;
};

const splitCommandTokens = (raw: string): string[] => {
  const tokens = raw.match(/"([^"\\]|\\.)*"|'([^'\\]|\\.)*'|\S+/g) || [];
  return tokens.map((token) => {
    if (token.length >= 2 && token.startsWith('"') && token.endsWith('"')) {
      return token.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
    }
    if (token.length >= 2 && token.startsWith("'") && token.endsWith("'")) {
      return token.slice(1, -1).replace(/\\'/g, "'").replace(/\\\\/g, "\\");
    }
    return token;
  });
};

const setFlagValue = (flags: Record<string, string>, key: string, value: string) => {
  const cleanedKey = toLowerText(key).replace(/^-+/, "");
  if (!cleanedKey) return;
  const normalizedValue = toText(value) || "true";
  flags[cleanedKey] = normalizedValue;
  const mapped = SHORT_FLAG_MAP[cleanedKey];
  if (mapped) flags[mapped] = normalizedValue;
  if (cleanedKey === "tenant-id" || cleanedKey === "tenantid" || cleanedKey === "workspace") {
    flags.tenant = normalizedValue;
  }
};

const normalizeResourceToken = (value: string) => {
  const key = toLowerText(value);
  return RESOURCE_ALIASES[key] || key;
};

const normalizeVerbToken = (value: string) => {
  const key = toLowerText(value);
  return VERB_ALIASES[key] || key;
};

const getSessionTenantContext = (session: ShellSessionRow | null): ShellTenantContext | null => {
  if (!session) return null;
  const metadata = session.metadata && typeof session.metadata === "object"
    ? (session.metadata as Record<string, unknown>)
    : null;
  const contextRaw = metadata?.tenant_context;
  if (contextRaw && typeof contextRaw === "object") {
    const context = contextRaw as Record<string, unknown>;
    const id = toText(context.id);
    const slug = toText(context.slug);
    const name = toText(context.name);
    if (isUuid(id)) {
      return { id, slug: slug || "-", name: name || "-" };
    }
  }
  if (isUuid(session.tenant_id)) {
    return {
      id: toText(session.tenant_id),
      slug: "-",
      name: "-",
    };
  }
  return null;
};

const buildSessionMetadata = (session: ShellSessionRow, tenant: ShellTenantContext | null) => {
  const base = session.metadata && typeof session.metadata === "object"
    ? { ...(session.metadata as Record<string, unknown>) }
    : {};
  if (!tenant) {
    delete base.tenant_context;
    return base;
  }
  return {
    ...base,
    tenant_context: {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      set_at: new Date().toISOString(),
    },
  };
};

const parseCommand = (input: unknown): CommandParseResult => {
  const raw = toText(input);
  const tokens = splitCommandTokens(raw);
  const flags: Record<string, string> = {};
  const positionals: string[] = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];

    if (token === "--") {
      for (let rest = index + 1; rest < tokens.length; rest += 1) {
        positionals.push(tokens[rest]);
      }
      break;
    }

    if (token.startsWith("--")) {
      const trimmed = token.slice(2);
      if (!trimmed) continue;
      const divider = trimmed.indexOf("=");
      if (divider > 0) {
        const key = trimmed.slice(0, divider);
        const value = trimmed.slice(divider + 1);
        setFlagValue(flags, key, value);
        continue;
      }
      const next = tokens[index + 1];
      if (next && !next.startsWith("-")) {
        setFlagValue(flags, trimmed, next);
        index += 1;
      } else {
        setFlagValue(flags, trimmed, "true");
      }
      continue;
    }

    if (token.startsWith("-") && token.length > 1) {
      const trimmed = token.slice(1);
      const divider = trimmed.indexOf("=");
      if (divider > 0) {
        const key = trimmed.slice(0, divider);
        const value = trimmed.slice(divider + 1);
        setFlagValue(flags, key, value);
        continue;
      }
      if (trimmed.length === 1) {
        const next = tokens[index + 1];
        if (next && !next.startsWith("-")) {
          setFlagValue(flags, trimmed, next);
          index += 1;
        } else {
          setFlagValue(flags, trimmed, "true");
        }
        continue;
      }
      trimmed.split("").forEach((part) => setFlagValue(flags, part, "true"));
      continue;
    }

    positionals.push(token);
  }

  return {
    raw,
    tokens,
    positionals,
    flags,
    normalized: positionals.map((part) => part.toLowerCase()).join(" "),
  };
};

const createAuthedClient = (req: Request) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase environment is not configured.");
  }

  const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization") ?? "";
  if (!authHeader) {
    throw new Error("Missing authorization header.");
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
};

const requireAdminContext = async (req: Request) => {
  const client = createAuthedClient(req);
  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();

  if (userError || !user?.id) {
    throw new Error("Authenticated user not found.");
  }

  const { data: isInternalAdmin, error: adminError } = await client.rpc("is_internal_admin", {
    p_email: user.email ?? null,
  });

  if (adminError) {
    throw new Error(adminError.message || "Failed to verify admin access.");
  }

  if (!isInternalAdmin) {
    throw new Error("Internal admin access is required.");
  }

  return { client, user };
};

const requireOwnedSession = async (
  client: SupabaseClient,
  sessionId: string,
): Promise<ShellSessionRow> => {
  const { data, error } = await client
    .from("admin_shell_sessions")
    .select("id, tenant_id, status, title, metadata, created_at, updated_at")
    .eq("id", sessionId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Unable to resolve shell session.");
  }
  if (!data?.id) {
    throw new Error("Shell session not found.");
  }
  return data;
};

const appendOutput = async (
  client: SupabaseClient,
  params: {
    sessionId: string;
    commandId?: string | null;
    stream: "stdin" | "stdout" | "stderr" | "system";
    lines: string[];
    metadata?: JsonMap;
  },
) => {
  const rows = (Array.isArray(params.lines) ? params.lines : [])
    .map((line) => toText(line))
    .filter(Boolean)
    .slice(0, MAX_OUTPUT_LINES_PER_WRITE)
    .map((content) => ({
      session_id: params.sessionId,
      command_id: params.commandId || null,
      stream: params.stream,
      content,
      metadata: params.metadata || {},
    }));

  if (!rows.length) return [];

  const { data, error } = await client
    .from("admin_shell_output")
    .insert(rows)
    .select("id, command_id, stream, content, created_at");

  if (error) {
    throw new Error(error.message || "Failed to append shell output.");
  }

  return (Array.isArray(data) ? data : []).sort((a, b) => Number(a.id || 0) - Number(b.id || 0));
};

const updateCommandState = async (
  client: SupabaseClient,
  commandId: string,
  patch: JsonMap,
) => {
  const payload = {
    ...patch,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await client
    .from("admin_shell_commands")
    .update(payload)
    .eq("id", commandId)
    .select(COMMAND_SELECT_FIELDS)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Failed to update shell command.");
  }

  return data || null;
};

const isCommandCancelled = async (client: SupabaseClient, commandId: string) => {
  const { data, error } = await client
    .from("admin_shell_commands")
    .select("cancel_requested, status")
    .eq("id", commandId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Failed to inspect command cancellation state.");
  }

  const status = toLowerText(data?.status);
  return Boolean(data?.cancel_requested) || status === "cancelled";
};

const runHelpCommand = () => {
  return [
    "Habuks Admin Terminal (MVP)",
    "",
    "Grammar:",
    "  <resource> <verb> [options]",
    "",
    "Resources:",
    "  ten (t)   tenants",
    "  mem (m)   members",
    "  prj (p)   projects",
    "  fin (f)   finance",
    "  doc       documents",
    "  log       activity logs",
    "  sys       platform status",
    "",
    "Global commands:",
    "  help",
    "  ls",
    "  clear | cls",
    "  pwd",
    "  whoami",
    "  cd ten <tenant_uuid|slug|name>",
    "  cd ..",
    "",
    "MVP commands:",
    "  ten ls [-n 20] [-s keyword]",
    "  ten show [tenant_uuid|slug|name]",
    "  ten pause [tenant_uuid|slug|name] [--days=30]",
    "  ten resume [tenant_uuid|slug|name]",
    "  mem ls [-t tenant] [-n 50]",
    "  prj ls [-t tenant] [-n 50]",
    "  prj show <project_id|name> [-t tenant]",
    "  log tail [-t tenant] [-n 100]",
    "  sys status",
    "",
    "Compatibility aliases:",
    "  tenants list             -> ten ls",
    "  tenant overview          -> ten show",
    "  tenants overivew         -> ten show",
    "  logs tail               -> log tail",
    "",
    "Resource help:",
    "  ten --help, mem --help, prj --help, fin --help, doc --help, log --help, sys --help",
  ];
};

const runResourceHelpCommand = (resource: string) => {
  if (resource === "ten") {
    return [
      "Tenant commands",
      "  ten ls [-n 20] [-s keyword]",
      "  ten show [tenant_uuid|slug|name]",
      "  ten stat [tenant_uuid|slug|name]",
      "  ten pause [tenant_uuid|slug|name] [--days=30]",
      "  ten resume [tenant_uuid|slug|name]",
      "  ten rm   (disabled in MVP)",
      "Aliases: t",
    ];
  }
  if (resource === "mem") {
    return [
      "Member commands",
      "  mem ls [-t tenant] [-n 50]",
      "  mem show <member_email|name|membership_id> [-t tenant]",
      "  mem pause <member_email|name|membership_id> [-t tenant]",
      "  mem resume <member_email|name|membership_id> [-t tenant]",
      "Aliases: m",
    ];
  }
  if (resource === "prj") {
    return [
      "Project commands",
      "  prj ls [-t tenant] [-n 50]",
      "  prj show <project_id|name> [-t tenant]",
      "  prj stat [-t tenant]",
      "  prj pause <project_id|name> [-t tenant]",
      "Aliases: p",
    ];
  }
  if (resource === "fin") {
    return [
      "Finance commands",
      "  fin ls [-t tenant] [-n 50]",
      "  fin stat [-t tenant]",
      "  fin show <transaction_id> [-t tenant]",
      "Aliases: f",
    ];
  }
  if (resource === "doc") {
    return [
      "Document commands",
      "  doc ls [-t tenant] [-n 50]",
      "  doc show <document_id> [-t tenant]   (detail lookup pending)",
      "  doc rm <document_id> [-t tenant]     (disabled in MVP)",
    ];
  }
  if (resource === "log") {
    return [
      "Log commands",
      "  log tail [-t tenant] [-n 100]",
      "  log sys [-n 100]",
      "Alias compatibility: logs tail -> log tail",
    ];
  }
  if (resource === "sys") {
    return [
      "System commands",
      "  sys status",
      "  sys stat",
    ];
  }
  return runHelpCommand();
};

const runLsCommand = (session: ShellSessionRow) => {
  const context = getSessionTenantContext(session);
  return [
    "help  ls  clear  pwd  whoami  cd  ten  mem  prj  fin  doc  log  sys",
    context?.slug && context.slug !== "-"
      ? `Context: ${context.slug} (${context.id})`
      : "Context: global",
    "Use `help` for command syntax.",
  ];
};

const runPwdCommand = (session: ShellSessionRow) => {
  const context = getSessionTenantContext(session);
  if (!context || !context.id) {
    return ["/internal-admin-shell"];
  }
  const slug = context.slug && context.slug !== "-" ? context.slug : context.id;
  return [`/internal-admin-shell/ten/${slug}`];
};

const runWhoAmICommand = (actorEmail: string | null) => [toText(actorEmail) || "internal-admin"];

const listTenantMatches = async (
  client: SupabaseClient,
  search: string | null,
  limit: number,
) => {
  const { data, error } = await client.rpc("admin_list_tenants", {
    p_search: search,
    p_limit: limit,
    p_offset: 0,
  });
  if (error) {
    throw new Error(error.message || "Failed to load tenant list.");
  }
  return Array.isArray(data) ? data : [];
};

const tenantLine = (row: Record<string, unknown>) => {
  const tenantName = toText(row?.tenant_name) || "-";
  const slug = toText(row?.slug) || "-";
  const id = toText(row?.tenant_id) || "-";
  const members = Number(row?.active_members_count || 0);
  const projects = Number(row?.projects_count || 0);
  const transactions = Number(row?.transactions_count || 0);
  return `${tenantName} (${slug}) | id:${id} | members:${members} | projects:${projects} | tx:${transactions}`;
};

const resolveTenantReference = async (
  client: SupabaseClient,
  tenantRef: string,
  options: { strict?: boolean } = {},
) => {
  const strict = options.strict === true;
  const cleanedRef = toText(tenantRef);
  if (!cleanedRef) {
    throw new Error("Tenant reference is required.");
  }

  if (isUuid(cleanedRef)) {
    const overviewRows = await runTenantOverviewCommand(client, cleanedRef);
    if (!overviewRows.row) {
      throw new Error("Tenant not found.");
    }
    const row = overviewRows.row;
    return {
      id: cleanedRef,
      slug: toText(row?.slug) || "-",
      name: toText(row?.tenant_name) || "-",
    };
  }

  const matches = await listTenantMatches(client, cleanedRef, 30);
  if (!matches.length) {
    throw new Error(`No tenant matched '${cleanedRef}'.`);
  }

  const loweredRef = cleanedRef.toLowerCase();
  const exactMatches = matches.filter((row) => {
    const slug = toLowerText(row?.slug);
    const name = toLowerText(row?.tenant_name);
    const email = toLowerText(row?.contact_email);
    return slug === loweredRef || name === loweredRef || email === loweredRef;
  });

  const selected = exactMatches[0] || matches[0];
  if (strict && !exactMatches.length && matches.length > 1) {
    const examples = matches.slice(0, 5).map((row) => `  - ${tenantLine(row as Record<string, unknown>)}`);
    throw new Error(
      [
        `Tenant reference '${cleanedRef}' matched multiple tenants.`,
        "Use a UUID or slug:",
        ...examples,
      ].join("\n"),
    );
  }

  return {
    id: toText(selected?.tenant_id),
    slug: toText(selected?.slug) || "-",
    name: toText(selected?.tenant_name) || "-",
  };
};

const updateSessionTenantContext = async (
  client: SupabaseClient,
  session: ShellSessionRow,
  tenant: ShellTenantContext | null,
) => {
  const metadata = buildSessionMetadata(session, tenant);
  const { data, error } = await client
    .from("admin_shell_sessions")
    .update({
      tenant_id: tenant?.id || null,
      metadata,
      updated_at: new Date().toISOString(),
    })
    .eq("id", session.id)
    .select("id, tenant_id, status, title, metadata, created_at, updated_at")
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Failed to update shell tenant context.");
  }
  return (data || session) as ShellSessionRow;
};

const resolveTenantForCommand = async (
  client: SupabaseClient,
  parsed: CommandParseResult,
  session: ShellSessionRow,
  options: {
    allowContext?: boolean;
    strict?: boolean;
    required?: boolean;
    refIndex?: number;
  } = {},
) => {
  const refIndex = options.refIndex ?? 2;
  const explicitRef = toText(
    parsed.positionals[refIndex] ||
      parsed.flags.tenant ||
      parsed.flags["tenant-id"] ||
      parsed.flags.tenantid ||
      parsed.flags.workspace ||
      parsed.flags.uuid,
  );

  if (explicitRef) {
    return resolveTenantReference(client, explicitRef, { strict: options.strict });
  }

  if (options.allowContext !== false) {
    const context = getSessionTenantContext(session);
    if (context?.id && isUuid(context.id)) {
      return context;
    }
  }

  if (options.required === true) {
    throw new Error("Tenant is required. Provide -t <tenant_uuid|slug> or run `cd ten <tenant>`.");
  }
  return null;
};

const runTenantsListCommand = async (
  client: SupabaseClient,
  flags: Record<string, string>,
) => {
  const search = toText(flags.search) || null;
  const limit = clampInt(flags.limit, 20, 1, 100);
  const rows = await listTenantMatches(client, search, limit);
  if (!rows.length) {
    return ["No tenants matched this filter."];
  }

  const lines = [`Returned ${rows.length} tenant${rows.length === 1 ? "" : "s"}:`];
  rows.forEach((row) => {
    lines.push(tenantLine(row as Record<string, unknown>));
  });
  return lines;
};

const runTenantOverviewCommand = async (
  client: SupabaseClient,
  tenantId: string,
) => {
  const { data, error } = await client.rpc("admin_get_tenant_overview", {
    p_tenant_id: tenantId,
  });

  if (error) {
    throw new Error(error.message || "Failed to fetch tenant overview.");
  }

  const row = Array.isArray(data) ? data[0] : null;
  if (!row) {
    return {
      row: null,
      lines: ["Tenant was not found for this overview request."],
    };
  }

  return {
    row,
    lines: [
      `Tenant: ${toText(row?.tenant_name) || "-"}`,
      `Tenant ID: ${toText(row?.tenant_id) || "-"}`,
      `Slug: ${toText(row?.slug) || "-"}`,
      `Created: ${formatDate(row?.created_at)}`,
      `Members: ${Number(row?.active_members_count || 0)}`,
      `Projects: ${Number(row?.projects_count || 0)}`,
      `Transactions: ${Number(row?.transactions_count || 0)}`,
      `Documents: ${Number(row?.documents_count || 0)}`,
    ],
  };
};

const runTenantStatsCommand = async (
  client: SupabaseClient,
  tenantId: string,
) => {
  const overview = await runTenantOverviewCommand(client, tenantId);
  if (!overview.row) return overview.lines;
  const members = Number(overview.row?.active_members_count || 0);
  const projects = Number(overview.row?.projects_count || 0);
  const transactions = Number(overview.row?.transactions_count || 0);
  const score = members + projects * 3 + Math.ceil(transactions / 30);
  return [
    ...overview.lines,
    `Operational load score: ${score}`,
  ];
};

const runTenantPauseCommand = async (
  client: SupabaseClient,
  tenantId: string,
  pauseDays: number,
  pause: boolean,
) => {
  const { data, error } = await client.rpc("admin_set_tenant_workspace_pause", {
    p_tenant_id: tenantId,
    p_pause: pause,
    p_reason: pause
      ? "Paused via internal admin shell command."
      : "Resumed via internal admin shell command.",
    p_pause_days: pauseDays,
  });

  if (error) {
    throw new Error(error.message || "Failed to update tenant workspace pause state.");
  }

  const row = Array.isArray(data) ? data[0] : null;
  const closureStatus = toLowerText(row?.workspace_closure?.status);
  if (pause) {
    return [
      `Workspace pause applied for tenant ${tenantId}.`,
      `Mode: ${closureStatus || "paused"}`,
      `Visibility forced private: ${row?.is_public === false ? "yes" : "no"}`,
    ];
  }
  return [
    `Workspace resumed for tenant ${tenantId}.`,
    `Workspace closure: ${closureStatus || "none"}`,
    `Visibility restored: ${row?.is_public === true ? "public" : "private"}`,
  ];
};

const listTenantMembers = async (
  client: SupabaseClient,
  tenantId: string,
  limit: number,
) => {
  const { data, error } = await client.rpc("admin_get_tenant_members", {
    p_tenant_id: tenantId,
    p_limit: limit,
  });
  if (error) {
    throw new Error(error.message || "Failed to read tenant members.");
  }
  return Array.isArray(data) ? data : [];
};

const memberLine = (row: Record<string, unknown>) =>
  `${toText(row?.member_name) || "-"} | ${toText(row?.email) || "-"} | role:${toText(row?.tenant_role) || "-"} | status:${toText(row?.tenant_status) || "-"} | joined:${formatDate(row?.joined_at)}`;

const resolveMemberForCommand = async (
  client: SupabaseClient,
  tenantId: string,
  memberRef: string,
) => {
  const rows = await listTenantMembers(client, tenantId, 500);
  if (!rows.length) {
    return { rows, selected: null };
  }

  const cleanedRef = toText(memberRef);
  if (!cleanedRef) {
    return { rows, selected: null };
  }

  const loweredRef = cleanedRef.toLowerCase();
  const selected = rows.find((row) => toText(row?.tenant_membership_id) === cleanedRef) ||
    rows.find((row) => toText(row?.member_id) === cleanedRef) ||
    rows.find((row) => toLowerText(row?.email) === loweredRef) ||
    rows.find((row) => toLowerText(row?.member_name) === loweredRef) ||
    rows.find((row) => toLowerText(row?.member_name).includes(loweredRef)) ||
    rows.find((row) => toLowerText(row?.email).includes(loweredRef));

  return { rows, selected: (selected || null) as Record<string, unknown> | null };
};

const runMembersListCommand = async (
  client: SupabaseClient,
  tenantId: string,
  limit: number,
) => {
  const rows = await listTenantMembers(client, tenantId, limit);
  if (!rows.length) {
    return ["No members found for this tenant."];
  }
  const lines = [`Returned ${rows.length} member${rows.length === 1 ? "" : "s"}:`];
  rows.forEach((row) => {
    lines.push(memberLine(row as Record<string, unknown>));
  });
  return lines;
};

const runMemberShowCommand = async (
  client: SupabaseClient,
  tenantId: string,
  memberRef: string,
) => {
  const resolved = await resolveMemberForCommand(client, tenantId, memberRef);
  if (!resolved.rows.length) {
    return ["No members found for this tenant."];
  }

  if (!resolved.selected) {
    const lines = [
      "Usage: mem show <member_email|name|membership_id>",
      "Recent members:",
    ];
    resolved.rows.slice(0, 12).forEach((row) => {
      lines.push(`  ${memberLine(row as Record<string, unknown>)}`);
    });
    return lines;
  }

  return [
    `Member: ${toText(resolved.selected.member_name) || "-"}`,
    `Email: ${toText(resolved.selected.email) || "-"}`,
    `Phone: ${toText(resolved.selected.phone_number) || "-"}`,
    `Role: ${toText(resolved.selected.tenant_role) || "-"}`,
    `Status: ${toText(resolved.selected.tenant_status) || "-"}`,
    `Joined: ${formatDate(resolved.selected.joined_at)}`,
    `Membership ID: ${toText(resolved.selected.tenant_membership_id) || "-"}`,
  ];
};

const runMemberStatusCommand = async (
  client: SupabaseClient,
  tenantId: string,
  memberRef: string,
  pause: boolean,
) => {
  const resolved = await resolveMemberForCommand(client, tenantId, memberRef);
  if (!resolved.rows.length) {
    return ["No members found for this tenant."];
  }

  if (!resolved.selected) {
    const action = pause ? "pause" : "resume";
    const lines = [`Usage: mem ${action} <member_email|name|membership_id>`, "Recent members:"];
    resolved.rows.slice(0, 12).forEach((row) => {
      lines.push(`  ${memberLine(row as Record<string, unknown>)}`);
    });
    return lines;
  }

  const membershipId = toText(resolved.selected.tenant_membership_id);
  if (!membershipId) {
    throw new Error("Selected member is missing tenant membership id.");
  }

  const targetStatus = pause ? "inactive" : "active";
  const { data, error } = await client.rpc("admin_update_tenant_membership", {
    p_tenant_membership_id: membershipId,
    p_role: null,
    p_status: targetStatus,
  });
  if (error) {
    throw new Error(error.message || "Failed to update tenant membership status.");
  }
  const row = Array.isArray(data) ? data[0] : null;

  return [
    `Member ${pause ? "paused" : "resumed"}: ${toText(row?.member_name || resolved.selected.member_name) || "-"}`,
    `Email: ${toText(row?.email || resolved.selected.email) || "-"}`,
    `Role: ${toText(row?.tenant_role || resolved.selected.tenant_role) || "-"}`,
    `Status: ${toText(row?.tenant_status || targetStatus) || targetStatus}`,
  ];
};

const listTenantProjects = async (
  client: SupabaseClient,
  tenantId: string,
  limit: number,
) => {
  const { data, error } = await client.rpc("admin_get_tenant_projects", {
    p_tenant_id: tenantId,
    p_limit: limit,
  });
  if (error) {
    throw new Error(error.message || "Failed to read tenant projects.");
  }
  return Array.isArray(data) ? data : [];
};

const resolveProjectForCommand = async (
  client: SupabaseClient,
  tenantId: string,
  projectRef: string,
) => {
  const rows = await listTenantProjects(client, tenantId, 500);
  if (!rows.length) {
    return { rows, selected: null };
  }

  const cleanedRef = toText(projectRef);
  if (!cleanedRef) {
    return { rows, selected: null };
  }

  const projectId = Number.parseInt(cleanedRef, 10);
  const loweredRef = cleanedRef.toLowerCase();
  const selected = rows.find((row) => Number(row?.project_id || 0) === projectId) ||
    rows.find((row) => toLowerText(row?.project_name) === loweredRef) ||
    rows.find((row) => toLowerText(row?.project_name).includes(loweredRef));

  return { rows, selected: (selected || null) as Record<string, unknown> | null };
};

const runProjectsListCommand = async (
  client: SupabaseClient,
  tenantId: string,
  limit: number,
) => {
  const rows = await listTenantProjects(client, tenantId, limit);
  if (!rows.length) {
    return ["No projects found for this tenant."];
  }
  const lines = [`Returned ${rows.length} project${rows.length === 1 ? "" : "s"}:`];
  rows.forEach((row) => {
    lines.push(
      `#${Number(row?.project_id || 0)} ${toText(row?.project_name) || "-"} | module:${toText(row?.module_key) || "-"} | status:${toText(row?.status) || "-"} | start:${toText(row?.start_date) || "-"}`,
    );
  });
  return lines;
};

const runProjectShowCommand = async (
  client: SupabaseClient,
  tenantId: string,
  projectRef: string,
) => {
  const resolved = await resolveProjectForCommand(client, tenantId, projectRef);
  if (!resolved.rows.length) {
    return ["No projects found for this tenant."];
  }

  if (!resolved.selected) {
    const lines = [
      "Usage: prj show <project_id|project_name>",
      "Recent projects:",
    ];
    resolved.rows.slice(0, 10).forEach((row) => {
      lines.push(`  #${Number(row?.project_id || 0)} ${toText(row?.project_name) || "-"}`);
    });
    return lines;
  }

  return [
    `Project: ${toText(resolved.selected.project_name) || "-"}`,
    `Project ID: ${Number(resolved.selected.project_id || 0)}`,
    `Module: ${toText(resolved.selected.module_key) || "-"}`,
    `Status: ${toText(resolved.selected.status) || "-"}`,
    `Start: ${toText(resolved.selected.start_date) || "-"}`,
    `Created: ${formatDate(resolved.selected.created_at)}`,
  ];
};

const runProjectStatCommand = async (
  client: SupabaseClient,
  tenantId: string,
) => {
  const rows = await listTenantProjects(client, tenantId, 500);
  if (!rows.length) {
    return ["No projects found for this tenant."];
  }
  const statusCounts = new Map<string, number>();
  rows.forEach((row) => {
    const status = toLowerText(row?.status) || "unknown";
    statusCounts.set(status, (statusCounts.get(status) || 0) + 1);
  });
  const lines = [`Total projects: ${rows.length}`];
  Array.from(statusCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([status, count]) => {
      lines.push(`  ${status}: ${count}`);
    });
  return lines;
};

const runProjectPauseCommand = async (
  client: SupabaseClient,
  tenantId: string,
  projectRef: string,
) => {
  const resolved = await resolveProjectForCommand(client, tenantId, projectRef);
  if (!resolved.rows.length) {
    return ["No projects found for this tenant."];
  }

  if (!resolved.selected) {
    const lines = [
      "Usage: prj pause <project_id|project_name>",
      "Recent projects:",
    ];
    resolved.rows.slice(0, 10).forEach((row) => {
      lines.push(`  #${Number(row?.project_id || 0)} ${toText(row?.project_name) || "-"}`);
    });
    return lines;
  }

  const projectId = Number.parseInt(toText(resolved.selected.project_id), 10);
  if (!Number.isInteger(projectId) || projectId <= 0) {
    throw new Error("Selected project has an invalid project id.");
  }

  const updatePayload = {
    status: "paused",
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await client
    .from("iga_projects")
    .update(updatePayload)
    .eq("id", projectId)
    .eq("tenant_id", tenantId)
    .select("id, name, status")
    .maybeSingle();

  if (error) {
    const message = toLowerText(error.message || error.details || "");
    if (
      message.includes("permission") ||
      message.includes("policy") ||
      message.includes("row-level") ||
      message.includes("relation") ||
      message.includes("column")
    ) {
      return [
        "Project pause command is not available in this environment yet.",
        `Target project: #${projectId} ${toText(resolved.selected.project_name) || "-"}`,
      ];
    }
    throw new Error(error.message || "Failed to pause project.");
  }

  if (!data?.id) {
    return [
      "No project row was updated.",
      `Target project: #${projectId} ${toText(resolved.selected.project_name) || "-"}`,
    ];
  }

  return [
    `Project paused: #${projectId}`,
    `Name: ${toText(data?.name) || toText(resolved.selected.project_name) || "-"}`,
    `Status: ${toText(data?.status) || "paused"}`,
  ];
};

const runFinanceListCommand = async (
  client: SupabaseClient,
  tenantId: string,
  limit: number,
) => {
  const { data, error } = await client.rpc("admin_get_tenant_transactions", {
    p_tenant_id: tenantId,
    p_limit: limit,
  });
  if (error) {
    throw new Error(error.message || "Failed to read tenant finance records.");
  }
  const rows = Array.isArray(data) ? data : [];
  if (!rows.length) {
    return ["No finance records found for this tenant."];
  }
  const lines = [`Returned ${rows.length} transaction${rows.length === 1 ? "" : "s"}:`];
  rows.forEach((row) => {
    lines.push(
      `${toText(row?.source) || "-"} | amount:${Number(row?.amount || 0)} | occurred:${formatDate(row?.occurred_at)} | details:${toText(row?.details) || "-"}`,
    );
  });
  return lines;
};

const runFinanceStatCommand = async (
  client: SupabaseClient,
  tenantId: string,
) => {
  const { data, error } = await client.rpc("admin_get_tenant_transactions", {
    p_tenant_id: tenantId,
    p_limit: 500,
  });
  if (error) {
    throw new Error(error.message || "Failed to read tenant finance records.");
  }
  const rows = Array.isArray(data) ? data : [];
  if (!rows.length) {
    return ["No finance records found for this tenant."];
  }
  const totalAmount = rows.reduce((sum, row) => sum + Number(row?.amount || 0), 0);
  return [
    `Transactions: ${rows.length}`,
    `Total amount: ${totalAmount.toLocaleString("en-US", { maximumFractionDigits: 2 })}`,
  ];
};

const runLogsTailCommand = async (
  client: SupabaseClient,
  flags: Record<string, string>,
  tenantContext: ShellTenantContext | null,
) => {
  const tenantRef = toText(flags.tenant || flags.tenantid || flags.workspace || flags.uuid);
  let tenantId: string | null = null;
  if (tenantRef) {
    if (isUuid(tenantRef)) {
      tenantId = tenantRef;
    } else {
      const resolved = await resolveTenantReference(client, tenantRef, { strict: false });
      tenantId = resolved.id;
    }
  } else if (tenantContext?.id && isUuid(tenantContext.id)) {
    tenantId = tenantContext.id;
  }

  const limit = clampInt(flags.limit, 50, 1, 200);
  const { data, error } = await client.rpc("admin_get_activity_logs", {
    p_tenant_id: tenantId,
    p_limit: limit,
    p_offset: 0,
  });

  if (error) {
    throw new Error(error.message || "Failed to read activity logs.");
  }

  const rows = Array.isArray(data) ? data : [];
  if (!rows.length) {
    return ["No activity logs matched this request."];
  }

  const lines = [`Showing ${rows.length} log entr${rows.length === 1 ? "y" : "ies"}:`];
  rows.forEach((row) => {
    const time = formatDate(row?.created_at);
    const tenantName = toText(row?.tenant_name) || "-";
    const action = toText(row?.action) || "-";
    const entity = toText(row?.entity) || "-";
    const entityId = toText(row?.entity_id) || "-";
    lines.push(`[${time}] ${tenantName} | ${action} | ${entity} | ${entityId}`);
  });
  return lines;
};

const runSystemStatusCommand = async (
  client: SupabaseClient,
) => {
  const tenants = await listTenantMatches(client, null, 500);
  const totalTenants = tenants.length;
  const totalUsers = tenants.reduce((sum, row) => sum + Number(row?.active_members_count || 0), 0);
  const totalProjects = tenants.reduce((sum, row) => sum + Number(row?.projects_count || 0), 0);
  const totalTransactions = tenants.reduce((sum, row) => sum + Number(row?.transactions_count || 0), 0);
  const needsAttention = tenants.filter((row) =>
    Number(row?.projects_count || 0) === 0 && Number(row?.transactions_count || 0) === 0
  ).length;

  return [
    "Habuks System Status",
    "",
    `Active Tenants: ${totalTenants}`,
    `Active Users: ${totalUsers}`,
    `Projects: ${totalProjects}`,
    `Transactions: ${totalTransactions}`,
    `Needs Attention: ${needsAttention}`,
  ];
};

const executeAllowedCommand = async (
  client: SupabaseClient,
  parsed: CommandParseResult,
  session: ShellSessionRow,
  actorEmail: string | null = null,
) => {
  const firstRaw = toLowerText(parsed.positionals[0]);
  const secondRaw = toLowerText(parsed.positionals[1]) === "overivew"
    ? "overview"
    : toLowerText(parsed.positionals[1]);
  const resource = normalizeResourceToken(firstRaw);
  const verb = normalizeVerbToken(secondRaw);
  const wantsResourceHelp = Boolean(parsed.flags.help || parsed.flags.h || verb === "help");

  if (!firstRaw) {
    return ["Type `help` for available commands."];
  }

  if (firstRaw === "help") {
    const maybeResource = normalizeResourceToken(toText(parsed.positionals[1]));
    if (HELPABLE_RESOURCES.has(maybeResource)) {
      return runResourceHelpCommand(maybeResource);
    }
    return runHelpCommand();
  }

  if (firstRaw === "ls") {
    return runLsCommand(session);
  }

  if (firstRaw === "pwd") {
    return runPwdCommand(session);
  }

  if (firstRaw === "whoami") {
    return runWhoAmICommand(actorEmail);
  }

  if (firstRaw === "clear" || firstRaw === "cls") {
    return [];
  }

  if (firstRaw === "cd") {
    const target = toText(parsed.positionals[1]);
    if (!target) {
      return runPwdCommand(session);
    }
    if (target === ".." || target === "/" || target === "~") {
      await updateSessionTenantContext(client, session, null);
      return ["Returned to global tenant context."];
    }
    if (normalizeResourceToken(target) === "ten") {
      const tenantRef = toText(parsed.positionals.slice(2).join(" "));
      if (!tenantRef) {
        throw new Error("Usage: cd ten <tenant_uuid|slug|name>");
      }
      const tenant = await resolveTenantReference(client, tenantRef, { strict: true });
      await updateSessionTenantContext(client, session, {
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
      });
      return [
        `Tenant context set.`,
        `Name: ${tenant.name}`,
        `Slug: ${tenant.slug}`,
        `Tenant ID: ${tenant.id}`,
      ];
    }
    throw new Error("Usage: cd ten <tenant_uuid|slug|name> | cd ..");
  }

  if (HELPABLE_RESOURCES.has(resource) && wantsResourceHelp) {
    return runResourceHelpCommand(resource);
  }

  if (resource === "ten") {
    if (!verb || verb === "ls" || verb === "search") {
      const flags = { ...parsed.flags };
      if (verb === "search" && !toText(flags.search)) {
        flags.search = toText(parsed.positionals.slice(2).join(" "));
      }
      return runTenantsListCommand(client, flags);
    }

    if (verb === "show") {
      const tenant = await resolveTenantForCommand(client, parsed, session, {
        required: false,
        strict: false,
      });
      if (!tenant?.id) {
        const options = await listTenantMatches(client, null, 8);
        const lines = [
          "Usage: ten show <tenant_uuid|slug|name>",
          "No tenant selected. Use `cd ten <tenant>` or pick one:",
        ];
        options.forEach((row) => lines.push(`  - ${tenantLine(row as Record<string, unknown>)}`));
        return lines;
      }
      const result = await runTenantOverviewCommand(client, tenant.id);
      return result.lines;
    }

    if (verb === "stat") {
      const tenant = await resolveTenantForCommand(client, parsed, session, {
        required: true,
        strict: false,
      });
      return runTenantStatsCommand(client, toText(tenant?.id));
    }

    if (verb === "pause" || verb === "resume") {
      const tenant = await resolveTenantForCommand(client, parsed, session, {
        required: true,
        strict: true,
      });
      const days = clampInt(parsed.flags.days, 30, 1, 365);
      return runTenantPauseCommand(client, toText(tenant?.id), days, verb === "pause");
    }

    if (verb === "rm") {
      return [
        "ten rm is disabled in MVP for safety.",
        "Use the tenant controls panel if hard deletion is required.",
      ];
    }
  }

  if (resource === "mem") {
    const tenant = await resolveTenantForCommand(client, parsed, session, {
      required: true,
      strict: false,
    });
    const tenantId = toText(tenant?.id);
    if (verb === "ls") {
      const limit = clampInt(parsed.flags.limit, 50, 1, 200);
      return runMembersListCommand(client, tenantId, limit);
    }
    if (verb === "show") {
      const memberRef = toText(parsed.positionals.slice(2).join(" "));
      return runMemberShowCommand(client, tenantId, memberRef);
    }
    if (verb === "pause") {
      const memberRef = toText(parsed.positionals.slice(2).join(" "));
      return runMemberStatusCommand(client, tenantId, memberRef, true);
    }
    if (verb === "resume") {
      const memberRef = toText(parsed.positionals.slice(2).join(" "));
      return runMemberStatusCommand(client, tenantId, memberRef, false);
    }
  }

  if (resource === "prj") {
    const tenant = await resolveTenantForCommand(client, parsed, session, {
      required: true,
      strict: false,
    });
    const tenantId = toText(tenant?.id);
    if (verb === "ls") {
      const limit = clampInt(parsed.flags.limit, 50, 1, 200);
      return runProjectsListCommand(client, tenantId, limit);
    }
    if (verb === "show") {
      const projectRef = toText(parsed.positionals[2] || parsed.flags.project || parsed.flags.id);
      return runProjectShowCommand(client, tenantId, projectRef);
    }
    if (verb === "stat") {
      return runProjectStatCommand(client, tenantId);
    }
    if (verb === "pause") {
      const projectRef = toText(parsed.positionals.slice(2).join(" "));
      return runProjectPauseCommand(client, tenantId, projectRef);
    }
  }

  if (resource === "fin") {
    const tenant = await resolveTenantForCommand(client, parsed, session, {
      required: true,
      strict: false,
    });
    const tenantId = toText(tenant?.id);
    if (verb === "ls") {
      const limit = clampInt(parsed.flags.limit, 50, 1, 200);
      return runFinanceListCommand(client, tenantId, limit);
    }
    if (verb === "stat") {
      return runFinanceStatCommand(client, tenantId);
    }
    if (verb === "show") {
      const ref = toText(parsed.positionals[2] || parsed.flags.id || parsed.flags.tx);
      if (!ref) {
        throw new Error("Usage: fin show <transaction_id>");
      }
      const lines = await runFinanceListCommand(client, tenantId, 500);
      const match = lines.find((line) => line.includes(ref));
      if (!match) return [`Transaction '${ref}' was not found.`];
      return [match];
    }
  }

  if (resource === "doc") {
    const tenant = await resolveTenantForCommand(client, parsed, session, {
      required: true,
      strict: false,
    });
    const tenantId = toText(tenant?.id);
    if (verb === "ls") {
      const limit = clampInt(parsed.flags.limit, 50, 1, 200);
      const { data, error } = await client
        .from("documents")
        .select("id, name, type, uploaded_at")
        .eq("tenant_id", tenantId)
        .order("uploaded_at", { ascending: false })
        .limit(limit);
      if (error) {
        throw new Error(error.message || "Failed to read tenant documents.");
      }
      const rows = Array.isArray(data) ? data : [];
      if (!rows.length) return ["No documents found for this tenant."];
      const lines = [`Returned ${rows.length} document${rows.length === 1 ? "" : "s"}:`];
      rows.forEach((row) => {
        lines.push(
          `#${Number(row?.id || 0)} ${toText(row?.name) || "-"} | type:${toText(row?.type) || "-"} | uploaded:${formatDate(row?.uploaded_at)}`,
        );
      });
      return lines;
    }
    if (verb === "show") {
      return ["Usage: doc ls (document detail lookup is coming next)."];
    }
    if (verb === "rm") {
      return [
        "doc rm is disabled in MVP for safety.",
        "Delete documents from the tenant detail panel.",
      ];
    }
  }

  if (resource === "log") {
    if (verb === "tail" || !verb) {
      const mergedFlags = {
        ...parsed.flags,
        tenant: parsed.flags.tenant || parsed.positionals[2] || "",
      };
      return runLogsTailCommand(client, mergedFlags, getSessionTenantContext(session));
    }
    if (verb === "sys") {
      const mergedFlags = {
        ...parsed.flags,
        tenant: "",
      };
      return runLogsTailCommand(client, mergedFlags, null);
    }
  }

  if (resource === "sys" && (verb === "status" || verb === "stat" || !verb)) {
    return runSystemStatusCommand(client);
  }

  throw new Error("Unsupported command. Type `help` to see allowed commands.");
};

const createQueuedCommand = async (
  client: SupabaseClient,
  params: {
    sessionId: string;
    input: string;
  },
) => {
  const parsed = parseCommand(params.input);
  if (!parsed.raw) {
    throw new Error("input is required.");
  }
  if (parsed.raw.length > 240) {
    throw new Error("Command input is too long.");
  }

  const { data: command, error: insertError } = await client
    .from("admin_shell_commands")
    .insert({
      session_id: params.sessionId,
      command_text: parsed.raw,
      normalized_command: parsed.normalized || null,
      status: "queued",
      metadata: {
        source: SHELL_FUNCTION,
      },
    })
    .select(COMMAND_SELECT_FIELDS)
    .single();

  if (insertError || !command?.id) {
    throw new Error(insertError?.message || "Failed to queue shell command.");
  }

  const output = await appendOutput(client, {
    sessionId: params.sessionId,
    commandId: String(command.id),
    stream: "stdin",
    lines: [`$ ${parsed.raw}`],
  });

  return {
    command,
    output,
    parsed,
  };
};

const requireSessionCommand = async (
  client: SupabaseClient,
  sessionId: string,
  commandId: string,
) => {
  const { data: command, error } = await client
    .from("admin_shell_commands")
    .select(COMMAND_SELECT_FIELDS)
    .eq("id", commandId)
    .eq("session_id", sessionId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Failed to resolve command.");
  }

  if (!command?.id) {
    throw new Error("Command not found.");
  }

  return command;
};

const handleStart = async (client: SupabaseClient, payload: JsonMap) => {
  const existingSessionId = toText(payload.session_id ?? payload.sessionId);
  if (existingSessionId) {
    const session = await requireOwnedSession(client, existingSessionId);
    return { session, output: [] };
  }

  const tenantId = toText(payload.tenant_id ?? payload.tenantId);
  if (tenantId && !isUuid(tenantId)) {
    throw new Error("Invalid tenant UUID in tenant_id.");
  }

  const title = toText(payload.title) || null;
  const insertPayload = {
    tenant_id: tenantId || null,
    title,
    status: "open",
    metadata: {
      source: SHELL_FUNCTION,
    },
  };

  const { data: session, error: sessionError } = await client
    .from("admin_shell_sessions")
    .insert(insertPayload)
    .select("id, tenant_id, status, title, metadata, created_at, updated_at")
    .single();

  if (sessionError || !session?.id) {
    throw new Error(sessionError?.message || "Failed to create shell session.");
  }

  const output = await appendOutput(client, {
    sessionId: String(session.id),
    stream: "system",
    lines: [
      "Shell session started.",
      "Type `help` for available commands.",
    ],
  });

  return { session, output };
};

const handleHistory = async (client: SupabaseClient, payload: JsonMap) => {
  const sessionId = toText(payload.session_id ?? payload.sessionId);
  if (!isUuid(sessionId)) {
    throw new Error("session_id is required.");
  }

  const session = await requireOwnedSession(client, sessionId);
  const afterId = clampInt(payload.after_id ?? payload.afterId, 0, 0, 9_999_999_999);
  const limit = clampInt(payload.limit, 120, 1, MAX_HISTORY_LIMIT);

  const { data: outputRows, error: outputError } = await client
    .from("admin_shell_output")
    .select("id, command_id, stream, content, created_at")
    .eq("session_id", sessionId)
    .gt("id", afterId)
    .order("id", { ascending: true })
    .limit(limit);

  if (outputError) {
    throw new Error(outputError.message || "Failed to read shell output.");
  }

  const { data: commands, error: commandsError } = await client
    .from("admin_shell_commands")
    .select(COMMAND_SELECT_FIELDS)
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (commandsError) {
    throw new Error(commandsError.message || "Failed to read shell commands.");
  }

  const output = Array.isArray(outputRows) ? outputRows : [];
  const nextAfterId = output.length ? Number(output[output.length - 1]?.id || afterId) : afterId;
  return {
    session,
    commands: Array.isArray(commands) ? commands : [],
    output,
    next_after_id: nextAfterId,
  };
};

const handleInput = async (client: SupabaseClient, payload: JsonMap) => {
  const sessionId = toText(payload.session_id ?? payload.sessionId);
  if (!isUuid(sessionId)) {
    throw new Error("session_id is required.");
  }

  const session = await requireOwnedSession(client, sessionId);
  if (toLowerText(session?.status) !== "open") {
    throw new Error("Shell session is not open.");
  }

  const queued = await createQueuedCommand(client, {
    sessionId,
    input: toText(payload.input),
  });

  return {
    session,
    command: queued.command,
    output: queued.output,
  };
};

const handleRun = async (
  client: SupabaseClient,
  payload: JsonMap,
  actorEmail: string | null = null,
) => {
  const sessionId = toText(payload.session_id ?? payload.sessionId);
  if (!isUuid(sessionId)) {
    throw new Error("session_id is required.");
  }

  const session = await requireOwnedSession(client, sessionId);
  if (toLowerText(session?.status) !== "open") {
    throw new Error("Shell session is not open.");
  }

  let command: Record<string, unknown> | null = null;
  let parsed: CommandParseResult | null = null;
  const commandIdFromPayload = toText(payload.command_id ?? payload.commandId);
  let collectedOutput: Array<Record<string, unknown>> = [];

  if (isUuid(commandIdFromPayload)) {
    command = await requireSessionCommand(client, sessionId, commandIdFromPayload);
    parsed = parseCommand(command.command_text);
  } else {
    const queued = await createQueuedCommand(client, {
      sessionId,
      input: toText(payload.input),
    });
    command = queued.command;
    parsed = queued.parsed;
    collectedOutput = [...queued.output];
  }

  if (!command?.id || !parsed?.raw) {
    throw new Error("Unable to resolve command for execution.");
  }

  const commandId = String(command.id);
  const currentStatus = toLowerText(command.status);
  if (currentStatus === "running") {
    throw new Error("Command is already running.");
  }
  if (currentStatus === "succeeded" || currentStatus === "failed" || currentStatus === "cancelled") {
    throw new Error("Command already finished.");
  }

  const runningCommand = await updateCommandState(client, commandId, {
    status: "running",
    started_at: command?.started_at || new Date().toISOString(),
  });

  const collect = (rows: Array<Record<string, unknown>>) => {
    if (!rows.length) return;
    collectedOutput.push(...rows);
  };

  let nextStatus = "succeeded";
  let exitCode = 0;
  let errorText: string | null = null;

  try {
    if (await isCommandCancelled(client, commandId)) {
      throw new CancelledCommandError();
    }

    const lines = await executeAllowedCommand(client, parsed, session, actorEmail);

    if (await isCommandCancelled(client, commandId)) {
      throw new CancelledCommandError();
    }

    collect(
      await appendOutput(client, {
        sessionId,
        commandId,
        stream: "stdout",
        lines,
      }),
    );
  } catch (error) {
    if (error instanceof CancelledCommandError) {
      nextStatus = "cancelled";
      exitCode = 130;
      collect(
        await appendOutput(client, {
          sessionId,
          commandId,
          stream: "system",
          lines: ["Command cancelled."],
        }),
      );
    } else {
      nextStatus = "failed";
      exitCode = 1;
      errorText = getErrorMessage(error, "Command failed.");
      collect(
        await appendOutput(client, {
          sessionId,
          commandId,
          stream: "stderr",
          lines: [errorText],
        }),
      );
    }
  }

  const updatedCommand = await updateCommandState(client, commandId, {
    status: nextStatus,
    exit_code: exitCode,
    error_text: errorText,
    finished_at: new Date().toISOString(),
    cancel_requested: nextStatus === "cancelled",
  });

  try {
    const tenantIdForAudit = toText(session?.tenant_id) || null;
    const metadata = {
      session_id: sessionId,
      command_id: commandId,
      status: nextStatus,
      exit_code: exitCode,
      command: parsed.raw,
    };
    await client.rpc("log_audit_event", {
      p_tenant_id: tenantIdForAudit,
      p_action: "admin_shell_command",
      p_entity: "admin_shell_commands",
      p_entity_id: commandId,
      p_metadata: metadata,
    });
  } catch {
    // Audit writes are best-effort to avoid blocking the shell flow.
  }

  const latestSession = await requireOwnedSession(client, sessionId);

  return {
    session: latestSession,
    command: updatedCommand || runningCommand,
    output: collectedOutput.sort((a, b) => Number(a.id || 0) - Number(b.id || 0)),
  };
};

const handleCancel = async (client: SupabaseClient, payload: JsonMap) => {
  const sessionId = toText(payload.session_id ?? payload.sessionId);
  const commandId = toText(payload.command_id ?? payload.commandId);

  if (!isUuid(sessionId)) {
    throw new Error("session_id is required.");
  }
  if (!isUuid(commandId)) {
    throw new Error("command_id is required.");
  }

  await requireOwnedSession(client, sessionId);

  const command = await requireSessionCommand(client, sessionId, commandId);

  const status = toLowerText(command.status);
  let updatedCommand = command;
  if (status === "running" || status === "queued") {
    updatedCommand = await updateCommandState(client, commandId, {
      cancel_requested: true,
    }) || command;
  }

  const output = await appendOutput(client, {
    sessionId,
    commandId,
    stream: "system",
    lines: [`Cancel requested for command ${commandId}.`],
  });

  return { command: updatedCommand, output };
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    const requestHeaders =
      req.headers.get("access-control-request-headers") ||
      req.headers.get("Access-Control-Request-Headers") ||
      BASE_HEADERS["Access-Control-Allow-Headers"];
    return new Response("ok", {
      status: 200,
      headers: {
        ...BASE_HEADERS,
        "Access-Control-Allow-Headers": requestHeaders,
      },
    });
  }

  if (req.method !== "POST") {
    return json(405, { ok: false, error: "Method not allowed." });
  }

  try {
    const { client, user } = await requireAdminContext(req);
    const payload = (await req.json()) as JsonMap;
    const op = toLowerText(payload?.op);

    if (!op) {
      return json(400, { ok: false, error: "op is required." });
    }

    if (op === "start") {
      const result = await handleStart(client, payload);
      return json(200, { ok: true, ...result });
    }

    if (op === "history") {
      const result = await handleHistory(client, payload);
      return json(200, { ok: true, ...result });
    }

    if (op === "input") {
      const result = await handleInput(client, payload);
      return json(200, { ok: true, ...result });
    }

    if (op === "run") {
      const result = await handleRun(client, payload, toText(user?.email) || null);
      return json(200, { ok: true, ...result });
    }

    if (op === "cancel") {
      const result = await handleCancel(client, payload);
      return json(200, { ok: true, ...result });
    }

    return json(400, { ok: false, error: `Unsupported op '${op}'.` });
  } catch (error) {
    const message = getErrorMessage(error, "Request failed.");
    const status = /required|invalid|not found|unsupported|missing/i.test(message) ? 400 : 500;
    return json(status, { ok: false, error: message });
  }
});
