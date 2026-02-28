/**
 * Get all members with their total welfare transaction amount (for admin UI)
 */
export async function getMembersWithTotalWelfare(tenantId) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase not configured");
  }

  if (tenantId) {
    const { data: membershipRows, error: membershipError } = await supabase
      .from("tenant_members")
      .select("member_id")
      .eq("tenant_id", tenantId);

    if (membershipError) {
      throw membershipError;
    }

    const memberIds = (membershipRows || []).map((row) => row.member_id).filter(Boolean);
    if (!memberIds.length) {
      return [];
    }

    const { data: memberData, error: memberError } = await supabase
      .from("members")
      .select("id, name, email, phone_number, role, status, join_date")
      .in("id", memberIds)
      .order("name", { ascending: true });

    if (memberError) {
      throw memberError;
    }

    const { data: welfareRows, error: welfareError } = await supabase
      .from("welfare_transactions")
      .select("member_id, amount")
      .in("member_id", memberIds)
      .eq("tenant_id", tenantId);

    if (welfareError) {
      throw welfareError;
    }

    const totals = new Map();
    (welfareRows || []).forEach((row) => {
      const current = totals.get(row.member_id) || 0;
      totals.set(row.member_id, current + Number(row.amount || 0));
    });

    return (memberData || []).map((member) => ({
      ...member,
      total_welfare: totals.get(member.id) || 0,
    }));
  }

  const fullSelect = "id, name, email, phone_number, role, status, join_date, total_welfare";
  let { data, error } = await supabase
    .from("member_total_welfare")
    .select(fullSelect)
    .order("name", { ascending: true });

  if (error && String(error.message || "").toLowerCase().includes("join_date")) {
    const fallback = await supabase
      .from("member_total_welfare")
      .select("id, name, email, phone_number, role, status, total_welfare")
      .order("name", { ascending: true });
    if (fallback.error) {
      throw fallback.error;
    }
    return fallback.data || [];
  }

  if (error) {
    throw error;
  }

  return data || [];
}
import { normalizeCurrencyCode } from "./currency.js";
import { supabase, isSupabaseConfigured } from "./supabase.js";

let supabaseFallbackEnabled = false;

const shouldUseSupabase = () =>
  isSupabaseConfigured && supabase && (!import.meta.env.DEV || !supabaseFallbackEnabled);

const isMissingColumnError = (error, columnName) => {
  if (!error || !columnName) return false;
  const message = [
    error?.message,
    error?.details,
    error?.hint,
  ]
    .map((value) => String(value || "").toLowerCase())
    .join(" ");
  const column = String(columnName).toLowerCase();
  if (!message.includes(column)) return false;
  if (message.includes("does not exist")) return true;
  if (message.includes("could not find") && message.includes("column")) return true;
  if (message.includes("schema cache") && message.includes("column")) return true;
  return false;
};

const isMissingRelationError = (error, relationName = "") => {
  if (!error) return false;
  const code = String(error?.code || "");
  const message = String(error?.message || error?.details || "").toLowerCase();
  const relation = String(relationName || "").toLowerCase();
  if (code === "42P01") return true;
  if (!message.includes("relation") || !message.includes("does not exist")) {
    return false;
  }
  if (!relation) return true;
  return message.includes(relation);
};

const markSupabaseUnavailable = (error) => {
  if (!import.meta.env.DEV || !error) return;
  const status = Number(error?.status || error?.statusCode || 0);
  const code = String(error?.code || "");
  const message = String(error?.message || error?.details || "").toLowerCase();
  if (
    status >= 400 ||
    code.startsWith("42") ||
    message.includes("column") ||
    message.includes("relation")
  ) {
    supabaseFallbackEnabled = true;
  }
};

/** Reset the dev-mode Supabase fallback flag (call after successful auth). */
export function resetSupabaseFallback() {
  supabaseFallbackEnabled = false;
}

/**
 * Get the current authenticated user's member profile
 */
export async function getCurrentMember() {
  if (!isSupabaseConfigured || !supabase) {
    console.warn("Supabase not configured");
    return null;
  }

  const buildMemberPayload = (user) => {
    const metadata = user?.user_metadata || {};
    const fallbackName = user?.email ? user.email.split("@")[0] : "Member";
    const name = (metadata.name || metadata.full_name || fallbackName || "Member").trim();
    const phone = (metadata.phone_number || metadata.phone || "").trim();
    const dateOfBirth = metadata.date_of_birth || null;

    return {
      name,
      email: user?.email || "",
      password_hash: "",
      join_date: new Date().toISOString().slice(0, 10),
      status: "active",
      role: "member",
      phone_number: phone || null,
      date_of_birth: dateOfBirth || null,
      auth_id: user?.id,
    };
  };

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error("Auth error:", authError);
    return null;
  }

  const { data: member, error } = await supabase
    .from("members")
    .select("*")
    .eq("auth_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Error fetching member:", error);
    return null;
  }

  if (member) {
    return member;
  }

  const email = String(user?.email || "").trim();
  if (email) {
    const { data: linkedMember, error: linkError } = await supabase
      .from("members")
      .update({ auth_id: user.id })
      .ilike("email", email)
      .is("auth_id", null)
      .select("*")
      .maybeSingle();

    if (linkError) {
      console.error("Error linking member profile by email:", linkError);
    } else if (linkedMember) {
      return linkedMember;
    }

    const { data: rpcLinked, error: rpcError } = await supabase.rpc("link_member_profile");
    if (rpcError) {
      console.error("Error linking member profile via RPC:", rpcError);
    } else if (rpcLinked) {
      return rpcLinked;
    }
  }

  const payload = buildMemberPayload(user);
  if (!payload.auth_id || !payload.email) {
    console.error("Missing auth_id or email for member profile creation.");
    return null;
  }

  const { data: createdMember, error: insertError } = await supabase
    .from("members")
    .insert(payload)
    .select("*")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      const { data: linkedMember, error: linkError } = await supabase
        .from("members")
        .update({ auth_id: payload.auth_id })
        .ilike("email", payload.email)
        .is("auth_id", null)
        .select("*")
        .maybeSingle();

      if (linkError) {
        console.error("Error linking existing member profile:", linkError);
        return null;
      }

      if (linkedMember) {
        return linkedMember;
      }

      console.error("Error creating member profile:", insertError);
      return null;
    }

    console.error("Error creating member profile:", insertError);
    return null;
  }

  return createdMember;
}

/**
 * Get contributions for a specific member
 */
export async function getMemberContributions(memberId, tenantId) {
  // Mock contributions for development
  const mockContributions = [
    { id: 1, member_id: memberId, amount: 500, date: '2025-12-15', cycle_number: 1 },
    { id: 2, member_id: memberId, amount: 500, date: '2025-12-30', cycle_number: 2 },
  ];

  if (!isSupabaseConfigured || !supabase) return mockContributions;

  let query = supabase
    .from("contributions")
    .select("*")
    .eq("member_id", memberId)
    .order("date", { ascending: false });
  query = applyTenantFilter(query, tenantId);
  const { data, error } = await query;

  if (error) {
    console.error("Error fetching contributions:", error);
    return [];
  }

  return data || [];
}

/**
 * Get contribution split transactions for a specific member
 */
export async function getContributionSplits(memberId, tenantId) {
  if (!isSupabaseConfigured || !supabase) return [];

  let query = supabase
    .from("contribution_splits")
    .select("*")
    .eq("member_id", memberId)
    .order("date", { ascending: false });
  query = applyTenantFilter(query, tenantId);
  const { data, error } = await query;

  if (error) {
    console.error("Error fetching contribution splits:", error);
    return [];
  }

  return data || [];
}

/**
 * Get payout schedule with member names
 */
export async function getPayoutSchedule(tenantId) {
  if (!isSupabaseConfigured || !supabase) return [];

  let query = supabase
    .from("payouts")
    .select(`
      *,
      members (id, name)
    `)
    .order("cycle_number", { ascending: true });
  query = applyTenantFilter(query, tenantId);
  const { data, error } = await query;

  if (error) {
    console.error("Error fetching payouts:", error);
    return [];
  }

  return data || [];
}

/**
 * Get a specific member's payout info
 */
export async function getMemberPayout(memberId, tenantId) {
  if (!isSupabaseConfigured || !supabase) return null;

  let query = supabase
    .from("payouts")
    .select("*")
    .eq("member_id", memberId);
  query = applyTenantFilter(query, tenantId);
  const { data, error } = await query.single();

  if (error) {
    console.error("Error fetching member payout:", error);
    return null;
  }

  return data;
}

/**
 * Get welfare balance for a member
 */
export async function getWelfareBalance(memberId, tenantId) {
  if (!isSupabaseConfigured || !supabase) return null;

  let query = supabase
    .from("welfare_balances")
    .select("*")
    .eq("member_id", memberId);
  query = applyTenantFilter(query, tenantId);
  const { data, error } = await query.single();

  if (error) {
    // If no balance record exists, return 0
    return { balance: 0 };
  }

  return data;
}

/**
 * Get welfare transactions (all group transactions)
 * Uses the welfare_transactions_view which joins with members for recipient names
 */
export async function getWelfareTransactions(memberId, tenantId) {
  if (!isSupabaseConfigured || !supabase) return [];

  // Try to use the view first (includes recipient names)
  let query = supabase
    .from("welfare_transactions_view")
    .select("id, tenant_id, recipient, date_of_issue, amount, status")
    .order("date_of_issue", { ascending: false });
  query = applyTenantFilter(query, tenantId);
  let { data, error } = await query;

  // Fallback to regular table with join if view doesn't exist
  if (error) {
    let fallbackQuery = supabase
      .from("welfare_transactions")
      .select(`
        id,
        date,
        amount,
        status,
        members (first_name, last_name)
      `)
      .order("date", { ascending: false });
    fallbackQuery = applyTenantFilter(fallbackQuery, tenantId);
    const result = await fallbackQuery;

    if (result.error) {
      console.error("Error fetching welfare transactions:", result.error);
      return [];
    }

    // Transform to match expected format
    data = (result.data || []).map(t => ({
      id: t.id,
      date_of_issue: t.date,
      recipient: t.members ? `${t.members.first_name} ${t.members.last_name}` : 'Group Welfare',
      amount: t.amount,
      status: t.status || 'Completed'
    }));
  }

  return data && data.length > 0 ? data : [];
}

/**
 * Get total welfare fund (current balance)
 */
export async function getTotalWelfareFund(tenantId) {
  if (!isSupabaseConfigured || !supabase) {
    return 0;
  }

  // Get the latest welfare balance
  let query = supabase
    .from("welfare_balances")
    .select("balance, cycle_id")
    .order("cycle_id", { ascending: false })
    .limit(1);
  query = applyTenantFilter(query, tenantId);
  const { data, error } = await query.single();

  if (error) {
    console.error("Error fetching welfare balance:", error);
    // Fallback: calculate from completed cycles
    return await calculateWelfareFromCycles(tenantId);
  }

  return data?.balance || 0;
}

/**
 * Calculate welfare balance from completed cycles
 */
async function calculateWelfareFromCycles(tenantId) {
  if (!isSupabaseConfigured || !supabase) return 0;

  let query = supabase
    .from("welfare_cycles")
    .select("cycle_number")
    .lte("end_date", new Date().toISOString().split("T")[0])
    .order("cycle_number", { ascending: false })
    .limit(1);
  query = applyTenantFilter(query, tenantId);
  const { data, error } = await query.single();

  if (error) {
    console.error("Error calculating welfare:", error);
    return 0;
  }

  // Ksh. 1,000 per cycle
  return (data?.cycle_number || 2) * 1000;
}

/**
 * Get welfare summary with cycle details
 */
export async function getWelfareSummary(tenantId) {
  const emptySummary = {
    currentBalance: 0,
    completedCycles: 0,
    totalCycles: 0,
    contributionPerCycle: 0,
    finalAmount: 0,
    nextPayoutDate: null,
    nextRecipient: null,
    cycles: [],
  };

  if (!isSupabaseConfigured || !supabase) return emptySummary;

  try {
    // Get welfare cycles
    let cyclesQuery = supabase
      .from("welfare_cycles")
      .select("*")
      .order("cycle_number", { ascending: true });
    cyclesQuery = applyTenantFilter(cyclesQuery, tenantId);
    const { data: cycles, error: cyclesError } = await cyclesQuery;

    if (cyclesError || !cycles || cycles.length === 0) {
      return emptySummary;
    }

    // Get payout schedule to match recipients
    let payoutsQuery = supabase
      .from("payouts")
      .select("cycle_number, member_id, members(name)")
      .order("cycle_number", { ascending: true });
    payoutsQuery = applyTenantFilter(payoutsQuery, tenantId);
    const { data: payouts } = await payoutsQuery;

    const payoutMap = {};
    (payouts || []).forEach(p => {
      payoutMap[p.cycle_number] = p.members?.name || 'TBD';
    });

    const today = new Date().toISOString().split("T")[0];
    const completedCycleRows = cycles.filter((c) => c.end_date && c.end_date <= today);
    const completedCycles = completedCycleRows.length;
    const totalCycles = cycles.length;
    const contributionPerCycle = completedCycles
      ? completedCycleRows.reduce((sum, c) => sum + Number(c.total_contributed || 0), 0) /
        completedCycles
      : 0;
    const finalAmount = totalCycles ? contributionPerCycle * totalCycles : 0;
    const lastCompleted = completedCycleRows[completedCycleRows.length - 1];
    const currentBalance = lastCompleted
      ? Number(lastCompleted.total_contributed || 0) - Number(lastCompleted.total_disbursed || 0)
      : 0;

    const enrichedCycles = cycles.map((c) => {
      const isCompleted = c.end_date && c.end_date <= today;
      const cycleBalance = Number(c.total_contributed || 0) - Number(c.total_disbursed || 0);
      const inProgress = !isCompleted && c.start_date && c.start_date <= today;
      return {
        cycle_number: c.cycle_number,
        payout_date: c.start_date,
        recipient: payoutMap[c.cycle_number] || "TBD",
        welfare_balance: cycleBalance,
        status: isCompleted ? "Completed" : inProgress ? "In Progress" : "Upcoming",
      };
    });

    const nextCycle = enrichedCycles.find(
      (c) => c.status === "Upcoming" || c.status === "In Progress"
    );

    return {
      currentBalance,
      completedCycles,
      totalCycles,
      contributionPerCycle,
      finalAmount,
      nextPayoutDate: nextCycle?.payout_date || null,
      nextRecipient: nextCycle?.recipient || null,
      cycles: enrichedCycles,
    };
  } catch (error) {
    console.error("Error fetching welfare summary:", error);
    return emptySummary;
  }
}

/**
 * Get all IGA projects
 */
export async function getProjects(tenantId) {
  // Mock projects for development
  const mockProjects = [
    {
      id: 1,
      code: "JGF",
      name: "Community Fish Farming",
      description: "Sustainable tilapia farming initiative",
      status: "active",
      start_date: "2025-06-01",
    },
    {
      id: 2,
      code: "JPP",
      name: "Poultry Keeping Project",
      description: "Egg and broiler production for local markets",
      status: "active",
      start_date: "2025-09-15",
    }
  ];

  if (!shouldUseSupabase()) return mockProjects;

  let query = supabase
    .from("iga_projects")
    .select(`
      *,
      project_leader_member:members!iga_projects_project_leader_fkey (name)
    `)
    .order("start_date", { ascending: false });
  query = applyTenantFilter(query, tenantId);
  const { data, error } = await query;

  if (error) {
    markSupabaseUnavailable(error);
    console.error("Error fetching projects:", error);
    return [];
  }

  return data || [];
}

export async function getPublicTenantProjects(tenantId, options = {}) {
  if (!shouldUseSupabase()) {
    return [];
  }

  const limit = Number.parseInt(String(options?.limit || 8), 10);
  const safeLimit = Number.isInteger(limit) && limit > 0 ? Math.min(limit, 24) : 8;

  let selectColumns =
    "id, tenant_id, code, name, description, short_description, image_url, status, start_date, end_date, is_visible";

  let query = supabase
    .from("iga_projects")
    .select(selectColumns)
    .eq("is_visible", true)
    .order("start_date", { ascending: false })
    .limit(safeLimit);
  query = applyTenantFilter(query, tenantId);

  let { data, error } = await query;

  if (error && isMissingColumnError(error, "is_visible")) {
    selectColumns =
      "id, tenant_id, code, name, description, short_description, image_url, status, start_date, end_date";
    let fallbackQuery = supabase
      .from("iga_projects")
      .select(selectColumns)
      .order("start_date", { ascending: false })
      .limit(safeLimit);
    fallbackQuery = applyTenantFilter(fallbackQuery, tenantId);
    ({ data, error } = await fallbackQuery);
  }

  if (error) {
    console.warn("Public tenant projects are unavailable:", error?.message || error);
    return [];
  }

  return Array.isArray(data) ? data : [];
}

/**
 * Get projects with member's participation status
 */
export async function getProjectsWithMembership(memberId, tenantId) {
  // Mock data for development only (when Supabase is unavailable)
  const mockProjects = [
    {
      id: 1,
      code: "JGF",
      module_key: "jgf",
      name: "Community Fish Farming",
      description: "Sustainable tilapia farming initiative to provide income and nutrition for the community.",
      status: "Active",
      start_date: "2025-06-01",
      member_count: 8,
      membership: null
    },
    {
      id: 2,
      code: "JPP",
      module_key: "jpp",
      name: "Poultry Keeping Project",
      description: "Egg and broiler production for local markets and group consumption.",
      status: "Active",
      start_date: "2025-09-15",
      member_count: 5,
      membership: null
    }
  ];

  if (!shouldUseSupabase()) {
    // Return mock data for development
    return mockProjects;
  }

  try {
    // Prefer module_key when available, but keep compatibility with older schemas.
    let projects = null;
    let projectsError = null;

    let projectsQuery = supabase
      .from("iga_projects")
      .select(
        "id, tenant_id, code, module_key, name, description, short_description, image_url, status, start_date, project_leader, is_visible"
      )
      .order("start_date", { ascending: false });
    projectsQuery = applyTenantFilter(projectsQuery, tenantId);
    ({ data: projects, error: projectsError } = await projectsQuery);

    if (projectsError && isMissingColumnError(projectsError, "module_key")) {
      let fallbackQuery = supabase
        .from("iga_projects")
        .select("id, tenant_id, code, name, description, short_description, image_url, status, start_date, project_leader, is_visible")
        .order("start_date", { ascending: false });
      fallbackQuery = applyTenantFilter(fallbackQuery, tenantId);
      ({ data: projects, error: projectsError } = await fallbackQuery);
    }

    if (projectsError) {
      markSupabaseUnavailable(projectsError);
      console.error("Error fetching projects:", projectsError);
      return [];
    }

    // No projects exist in this workspace.
    if (!projects || projects.length === 0) {
      return [];
    }

    const projectIds = projects
      .map((project) => Number.parseInt(String(project?.id), 10))
      .filter((projectId) => Number.isInteger(projectId) && projectId > 0);
    const budgetSummaryByProject = new Map();

    if (projectIds.length) {
      try {
        let budgetsQuery = supabase
          .from("iga_budgets")
          .select("project_id, item, planned_amount, date")
          .in("project_id", projectIds);
        budgetsQuery = applyTenantFilter(budgetsQuery, tenantId);
        const { data: budgetRows, error: budgetError } = await budgetsQuery;

        if (budgetError) {
          console.warn("Unable to fetch project budget summaries:", budgetError);
        } else {
          (budgetRows || []).forEach((row) => {
            const projectId = Number.parseInt(String(row?.project_id), 10);
            if (!Number.isInteger(projectId) || projectId <= 0) return;

            const itemKey = String(row?.item || "").trim().toLowerCase();
            if (itemKey !== "total budget" && itemKey !== "expected revenue") return;

            const amount = Number(row?.planned_amount);
            if (!Number.isFinite(amount) || amount < 0) return;

            const timestampSource = row?.date || "";
            const timestamp = Date.parse(timestampSource);
            const safeTimestamp = Number.isFinite(timestamp) ? timestamp : 0;

            const current = budgetSummaryByProject.get(projectId) || {
              budget_total: null,
              budget_total_ts: -1,
              expected_revenue: null,
              expected_revenue_ts: -1,
            };

            if (itemKey === "total budget" && safeTimestamp >= current.budget_total_ts) {
              current.budget_total = amount;
              current.budget_total_ts = safeTimestamp;
            }
            if (itemKey === "expected revenue" && safeTimestamp >= current.expected_revenue_ts) {
              current.expected_revenue = amount;
              current.expected_revenue_ts = safeTimestamp;
            }

            budgetSummaryByProject.set(projectId, current);
          });
        }
      } catch (budgetSummaryError) {
        console.warn("Error preparing project budget summary map:", budgetSummaryError);
      }
    }

    // Get member count for each project
    const projectsWithCounts = await Promise.all(
      projects.map(async (project) => {
        let memberCount = 0;
        let membership = null;
        const projectId = Number.parseInt(String(project?.id), 10);

        try {
          let countQuery = supabase
            .from("iga_committee_members")
            .select("*", { count: "exact", head: true })
            .eq("project_id", project.id);
          countQuery = applyTenantFilter(countQuery, tenantId);
          const { count } = await countQuery;
          memberCount = count || 0;
        } catch (e) {
          console.log("Error getting member count:", e);
        }

        // Check if current member is part of this project
        if (memberId) {
          try {
            let membershipQuery = supabase
              .from("iga_committee_members")
              .select("term_start, role")
              .eq("project_id", project.id)
              .eq("member_id", memberId)
              .maybeSingle();
            membershipQuery = applyTenantFilter(membershipQuery, tenantId);
            const { data: memberData } = await membershipQuery;

            membership = memberData;
          } catch (e) {
            console.log("Error checking membership:", e);
          }
        }

        return {
          ...project,
          module_key: resolveModuleKey(project?.module_key || project?.code) || null,
          budget_total:
            Number.isInteger(projectId) && budgetSummaryByProject.has(projectId)
              ? budgetSummaryByProject.get(projectId)?.budget_total ?? null
              : null,
          expected_revenue:
            Number.isInteger(projectId) && budgetSummaryByProject.has(projectId)
              ? budgetSummaryByProject.get(projectId)?.expected_revenue ?? null
              : null,
          member_count: memberCount,
          membership
        };
      })
    );

    return projectsWithCounts;
  } catch (error) {
    console.error("Error in getProjectsWithMembership:", error);
    return [];
  }
}

/**
 * Create an IGA project
 */
export async function createIgaProject(payload = {}, tenantId) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  const name = normalizeOptional(payload?.name);
  if (!name) {
    throw new Error("Project name is required");
  }

  const moduleRaw = normalizeOptional(payload?.module_key);
  let moduleKey = moduleRaw ? String(moduleRaw).trim().toLowerCase() : "generic";
  moduleKey = moduleKey.replace(/[\s-]+/g, "_").replace(/[^a-z0-9_]/g, "");
  if (!/^[a-z][a-z0-9_]*$/.test(moduleKey)) {
    moduleKey = "generic";
  }

  const projectLeaderRaw = normalizeOptional(payload?.project_leader);
  const projectLeader =
    projectLeaderRaw === null ? null : Number.parseInt(String(projectLeaderRaw), 10);
  if (projectLeaderRaw !== null && !Number.isInteger(projectLeader)) {
    throw new Error("Invalid project leader");
  }

  const insertPayload = {
    name,
    code: normalizeOptional(payload?.code)
      ? String(payload.code).trim().toUpperCase()
      : null,
    module_key: moduleKey,
    description: normalizeOptional(payload?.description),
    short_description: normalizeOptional(payload?.short_description),
    status: normalizeOptional(payload?.status) || "active",
    start_date: normalizeOptional(payload?.start_date),
    project_leader: projectLeader,
    tenant_id: tenantId ?? normalizeOptional(payload?.tenant_id),
    is_visible: payload?.is_visible ?? true,
  };

  if (!insertPayload.short_description && insertPayload.description) {
    insertPayload.short_description = insertPayload.description;
  }

  const { data, error } = await supabase
    .from("iga_projects")
    .insert(insertPayload)
    .select("id, code, module_key, name, description, short_description, status, start_date, project_leader")
    .single();

  if (error) {
    console.error("Error creating project:", error);
    if (error.code === "23505") {
      throw new Error("A project with the same code already exists.");
    }
    if (error.code === "42501") {
      throw new Error("You do not have permission to create projects.");
    }
    throw new Error("Failed to create project");
  }

  return {
    ...data,
    module_key: resolveModuleKey(data?.module_key || data?.code) || data?.module_key || "generic",
    member_count: 0,
    membership: null,
  };
}

const MANAGED_BUDGET_ITEM_KEYS = new Set([
  "total budget",
  "expected revenue",
  "budget plan details",
]);

const parseNonNegativeNumberOrNull = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("Budget values must be non-negative numbers.");
  }
  return parsed;
};

const parseProjectIdOrThrow = (projectId) => {
  const parsed = Number.parseInt(String(projectId), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("Project id is required.");
  }
  return parsed;
};

const normalizeModuleKeyForProject = (value) => {
  const moduleRaw = normalizeOptional(value);
  let moduleKey = moduleRaw ? String(moduleRaw).trim().toLowerCase() : "generic";
  moduleKey = moduleKey.replace(/[\s-]+/g, "_").replace(/[^a-z0-9_]/g, "");
  if (!/^[a-z][a-z0-9_]*$/.test(moduleKey)) {
    moduleKey = "generic";
  }
  return moduleKey;
};

const parseProjectLeader = (value) => {
  const normalized = normalizeOptional(value);
  if (normalized === null) return null;
  const parsed = Number.parseInt(String(normalized), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("Invalid project leader");
  }
  return parsed;
};

const extractBirdStoragePath = (value) => {
  if (!value) return null;
  const raw = String(value);
  if (!raw) return null;

  let path = raw;
  if (raw.startsWith("http")) {
    const markers = [
      "/storage/v1/object/public/birds/",
      "/storage/v1/object/sign/birds/",
      "/storage/v1/object/birds/",
    ];
    const marker = markers.find((item) => raw.includes(item));
    if (!marker) return null;
    path = raw.split(marker)[1] || "";
  }

  if (path.includes("?")) {
    path = path.split("?")[0];
  }
  path = path.replace(/^\/+/, "");
  if (!path) return null;
  return path;
};

export async function getProjectEditorData(projectId, tenantId) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  const parsedProjectId = parseProjectIdOrThrow(projectId);

  let projectQuery = supabase
    .from("iga_projects")
    .select(
      "id, code, module_key, name, description, short_description, status, start_date, project_leader, is_visible, image_url"
    )
    .eq("id", parsedProjectId)
    .single();
  projectQuery = applyTenantFilter(projectQuery, tenantId);
  const { data: project, error: projectError } = await projectQuery;

  if (projectError) {
    console.error("Error fetching project for edit:", projectError);
    throw new Error("Failed to load project for editing.");
  }

  let budgetQuery = supabase
    .from("iga_budgets")
    .select("id, item, planned_amount, actual_amount, date, notes")
    .eq("project_id", parsedProjectId)
    .order("date", { ascending: true });
  budgetQuery = applyTenantFilter(budgetQuery, tenantId);
  const { data: budgetEntries, error: budgetError } = await budgetQuery;
  if (budgetError) {
    console.error("Error loading project budget entries:", budgetError);
    throw new Error("Failed to load project budget details.");
  }

  const memberAssignments = await getProjectMembersAdmin(parsedProjectId, tenantId);

  let galleryQuery = supabase
    .from("project_gallery")
    .select("id, image_url, caption, is_primary, display_order")
    .eq("project_id", parsedProjectId)
    .order("display_order", { ascending: true });
  galleryQuery = applyTenantFilter(galleryQuery, tenantId);
  const { data: gallery, error: galleryError } = await galleryQuery;
  if (galleryError) {
    console.error("Error loading project gallery:", galleryError);
    throw new Error("Failed to load project media.");
  }

  return {
    project,
    budget_entries: budgetEntries || [],
    member_assignments: memberAssignments || [],
    gallery: gallery || [],
  };
}

export async function getTenantProjectMediaLibrary(tenantId, options = {}) {
  if (!shouldUseSupabase()) {
    return [];
  }
  if (!tenantId) {
    return [];
  }

  const perProjectLimit = Number.parseInt(String(options?.perProjectLimit || 12), 10);
  const safePerProjectLimit =
    Number.isInteger(perProjectLimit) && perProjectLimit > 0
      ? Math.min(perProjectLimit, 50)
      : 12;

  let query = supabase
    .from("project_gallery")
    .select("id, project_id, image_url, caption, is_primary, display_order, created_at")
    .order("project_id", { ascending: true })
    .order("is_primary", { ascending: false })
    .order("display_order", { ascending: true });
  query = applyTenantFilter(query, tenantId);
  const { data, error } = await query;

  if (error && isMissingRelationError(error, "project_gallery")) {
    console.warn("Project gallery relation missing. Media pool disabled:", error?.message || error);
    return [];
  }
  if (error) {
    console.error("Error fetching tenant project media library:", error);
    return [];
  }

  if (!Array.isArray(data) || !data.length) {
    return [];
  }

  const perProjectCounter = new Map();
  return data.filter((row) => {
    const projectId = Number.parseInt(String(row?.project_id || ""), 10);
    if (!Number.isInteger(projectId) || projectId <= 0) {
      return false;
    }
    const count = perProjectCounter.get(projectId) || 0;
    if (count >= safePerProjectLimit) {
      return false;
    }
    perProjectCounter.set(projectId, count + 1);
    return true;
  });
}

export async function updateIgaProject(projectId, payload = {}, tenantId) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  const parsedProjectId = parseProjectIdOrThrow(projectId);
  const updatePayload = {};

  if (Object.prototype.hasOwnProperty.call(payload, "name")) {
    const name = normalizeOptional(payload?.name);
    if (!name) {
      throw new Error("Project name is required.");
    }
    updatePayload.name = name;
  }
  if (Object.prototype.hasOwnProperty.call(payload, "code")) {
    updatePayload.code = normalizeOptional(payload?.code)
      ? String(payload.code).trim().toUpperCase()
      : null;
  }
  if (Object.prototype.hasOwnProperty.call(payload, "module_key")) {
    updatePayload.module_key = normalizeModuleKeyForProject(payload?.module_key);
  }
  if (Object.prototype.hasOwnProperty.call(payload, "description")) {
    updatePayload.description = normalizeOptional(payload?.description);
  }
  if (Object.prototype.hasOwnProperty.call(payload, "short_description")) {
    updatePayload.short_description = normalizeOptional(payload?.short_description);
  }
  if (Object.prototype.hasOwnProperty.call(payload, "status")) {
    updatePayload.status = normalizeOptional(payload?.status) || "active";
  }
  if (Object.prototype.hasOwnProperty.call(payload, "start_date")) {
    updatePayload.start_date = normalizeOptional(payload?.start_date);
  }
  if (Object.prototype.hasOwnProperty.call(payload, "project_leader")) {
    updatePayload.project_leader = parseProjectLeader(payload?.project_leader);
  }
  if (Object.prototype.hasOwnProperty.call(payload, "is_visible")) {
    updatePayload.is_visible = Boolean(payload?.is_visible);
  }
  if (Object.prototype.hasOwnProperty.call(payload, "image_url")) {
    updatePayload.image_url = normalizeOptional(payload?.image_url);
  }

  if (
    Object.prototype.hasOwnProperty.call(updatePayload, "description") &&
    !Object.prototype.hasOwnProperty.call(updatePayload, "short_description") &&
    updatePayload.description
  ) {
    updatePayload.short_description = updatePayload.description;
  }

  if (!Object.keys(updatePayload).length) {
    throw new Error("No project fields to update.");
  }

  let query = supabase
    .from("iga_projects")
    .update(updatePayload)
    .eq("id", parsedProjectId);
  query = applyTenantFilter(query, tenantId);
  const { data, error } = await query
    .select(
      "id, code, module_key, name, description, short_description, status, start_date, project_leader, is_visible, image_url"
    )
    .single();

  if (error) {
    console.error("Error updating project:", error);
    if (error.code === "42501") {
      throw new Error("You do not have permission to update this project.");
    }
    throw new Error("Failed to update project.");
  }

  return data;
}

export async function setIgaProjectVisibility(projectId, isVisible, tenantId) {
  return updateIgaProject(projectId, { is_visible: Boolean(isVisible) }, tenantId);
}

export async function replaceIgaProjectBudgetPlan(projectId, plan = {}, tenantId) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  const parsedProjectId = parseProjectIdOrThrow(projectId);
  const totalBudget = parseNonNegativeNumberOrNull(plan?.total_budget);
  const expectedRevenue = parseNonNegativeNumberOrNull(plan?.expected_revenue);
  const fundingSource = normalizeOptional(plan?.funding_source) || "member_contributions";
  const payoutSchedule = normalizeOptional(plan?.payout_schedule) || "monthly";
  const notes = normalizeOptional(plan?.notes);
  const budgetDate = normalizeOptional(plan?.date) || new Date().toISOString().slice(0, 10);

  let existingQuery = supabase
    .from("iga_budgets")
    .select("id, item")
    .eq("project_id", parsedProjectId);
  existingQuery = applyTenantFilter(existingQuery, tenantId);
  const { data: existingRows, error: existingError } = await existingQuery;
  if (existingError) {
    console.error("Error loading existing budget plan entries:", existingError);
    throw new Error("Failed to update project budget details.");
  }

  const managedRowIds = (existingRows || [])
    .filter((row) => MANAGED_BUDGET_ITEM_KEYS.has(String(row?.item || "").trim().toLowerCase()))
    .map((row) => row.id)
    .filter((id) => Number.isInteger(id));

  if (managedRowIds.length) {
    let deleteQuery = supabase
      .from("iga_budgets")
      .delete()
      .eq("project_id", parsedProjectId)
      .in("id", managedRowIds);
    deleteQuery = applyTenantFilter(deleteQuery, tenantId);
    const { error: deleteError } = await deleteQuery;
    if (deleteError) {
      console.error("Error deleting managed budget plan entries:", deleteError);
      throw new Error("Failed to update project budget details.");
    }
  }

  const budgetDetailNotes = [
    `Funding source: ${fundingSource}`,
    `Payout schedule: ${payoutSchedule}`,
    notes ? `Notes: ${notes}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const insertEntries = [];
  if (totalBudget !== null) {
    insertEntries.push({
      item: "Total budget",
      planned_amount: totalBudget,
      date: budgetDate,
    });
  }
  if (expectedRevenue !== null) {
    insertEntries.push({
      item: "Expected revenue",
      planned_amount: expectedRevenue,
      date: budgetDate,
    });
  }
  if (budgetDetailNotes) {
    insertEntries.push({
      item: "Budget plan details",
      date: budgetDate,
      notes: budgetDetailNotes,
    });
  }

  if (!insertEntries.length) {
    return [];
  }

  return createIgaBudgetEntries(parsedProjectId, insertEntries, tenantId);
}

export async function syncProjectMemberAssignments(projectId, assignments = [], tenantId) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  const parsedProjectId = parseProjectIdOrThrow(projectId);
  const desiredMap = new Map();
  (Array.isArray(assignments) ? assignments : []).forEach((entry) => {
    const memberId = Number.parseInt(String(entry?.member_id), 10);
    if (!Number.isInteger(memberId) || memberId <= 0) return;
    desiredMap.set(memberId, {
      member_id: memberId,
      role: normalizeOptional(entry?.role) || "Member",
      term_start: normalizeOptional(entry?.term_start) || new Date().toISOString().slice(0, 10),
    });
  });

  let existingQuery = supabase
    .from("iga_committee_members")
    .select("id, member_id, role, term_start")
    .eq("project_id", parsedProjectId);
  existingQuery = applyTenantFilter(existingQuery, tenantId);
  const { data: existingRows, error: existingError } = await existingQuery;
  if (existingError) {
    console.error("Error loading existing project members:", existingError);
    throw new Error("Failed to sync project members.");
  }

  const existingByMember = new Map(
    (existingRows || [])
      .filter((row) => Number.isInteger(row?.member_id))
      .map((row) => [row.member_id, row])
  );

  for (const row of existingRows || []) {
    if (!Number.isInteger(row?.member_id)) continue;
    if (desiredMap.has(row.member_id)) continue;
    let deleteQuery = supabase.from("iga_committee_members").delete().eq("id", row.id);
    deleteQuery = applyTenantFilter(deleteQuery, tenantId);
    const { error } = await deleteQuery;
    if (error) {
      console.error("Error removing project member:", error);
      throw new Error("Failed to sync project members.");
    }
  }

  for (const [memberId, desired] of desiredMap.entries()) {
    const existing = existingByMember.get(memberId);
    if (!existing) {
      const { error } = await supabase
        .from("iga_committee_members")
        .insert({
          project_id: parsedProjectId,
          member_id: memberId,
          role: desired.role,
          term_start: desired.term_start,
          tenant_id: tenantId ?? null,
        });
      if (error) {
        console.error("Error assigning project member:", error);
        throw new Error("Failed to sync project members.");
      }
      continue;
    }

    const existingRole = normalizeOptional(existing?.role) || "Member";
    const existingTerm = normalizeOptional(existing?.term_start);
    if (existingRole === desired.role && existingTerm === desired.term_start) {
      continue;
    }

    let updateQuery = supabase
      .from("iga_committee_members")
      .update({
        role: desired.role,
        term_start: desired.term_start,
      })
      .eq("id", existing.id);
    updateQuery = applyTenantFilter(updateQuery, tenantId);
    const { error } = await updateQuery;
    if (error) {
      console.error("Error updating project member assignment:", error);
      throw new Error("Failed to sync project members.");
    }
  }

  return true;
}

export async function deleteProjectMediaAssets(projectId, galleryIds = [], tenantId) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  const parsedProjectId = parseProjectIdOrThrow(projectId);

  let rowsQuery = supabase
    .from("project_gallery")
    .select("id, image_url")
    .eq("project_id", parsedProjectId);
  if (Array.isArray(galleryIds) && galleryIds.length) {
    rowsQuery = rowsQuery.in("id", galleryIds);
  }
  rowsQuery = applyTenantFilter(rowsQuery, tenantId);
  const { data: rows, error: rowsError } = await rowsQuery;
  if (rowsError) {
    console.error("Error loading media rows for delete:", rowsError);
    throw new Error("Failed to remove project media.");
  }

  if (!rows?.length) {
    return { deleted: 0 };
  }

  let deleteQuery = supabase
    .from("project_gallery")
    .delete()
    .eq("project_id", parsedProjectId)
    .in("id", rows.map((row) => row.id));
  deleteQuery = applyTenantFilter(deleteQuery, tenantId);
  const { error: deleteError } = await deleteQuery;
  if (deleteError) {
    console.error("Error deleting media rows:", deleteError);
    throw new Error("Failed to remove project media.");
  }

  const paths = rows
    .map((row) => extractBirdStoragePath(row?.image_url))
    .filter(Boolean);
  if (paths.length) {
    const { error: storageError } = await supabase.storage.from("birds").remove(paths);
    if (storageError) {
      console.warn("Media rows deleted but storage cleanup failed:", storageError);
    }
  }

  return { deleted: rows.length };
}

export async function deleteIgaProject(projectId, tenantId) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  const parsedProjectId = parseProjectIdOrThrow(projectId);

  const childTables = [
    "iga_committee_members",
    "iga_budgets",
    "iga_inventory",
    "iga_reports",
    "iga_sales",
    "iga_activities",
    "iga_beneficiaries",
    "iga_training_sessions",
    "project_gallery",
    "project_goals",
    "project_volunteer_roles",
    "project_faq",
    "project_activities",
    "project_donation_items",
    "project_expenses",
    "project_sales",
    "project_products",
    "jpp_birds",
    "jpp_weekly_growth",
    "jpp_daily_log",
    "jpp_batches",
    "jpp_expenses",
    "jgf_farming_activities",
    "jgf_crop_cycles",
    "jgf_land_leases",
    "jgf_inventory",
    "jgf_purchases",
    "jgf_sales",
    "jgf_expenses",
    "jgf_production_logs",
    "jgf_batches",
  ];

  await deleteProjectMediaAssets(parsedProjectId, [], tenantId);

  for (const tableName of childTables) {
    if (tableName === "project_gallery") continue;
    try {
      let query = supabase.from(tableName).delete().eq("project_id", parsedProjectId);
      query = applyTenantFilter(query, tenantId);
      const { error } = await query;
      if (error) {
        const code = String(error?.code || "");
        if (code === "42P01") {
          continue;
        }
        throw error;
      }
    } catch (error) {
      console.error(`Error deleting child records from ${tableName}:`, error);
      throw new Error("Failed to delete project. Hide it first or remove linked records.");
    }
  }

  let projectDeleteQuery = supabase.from("iga_projects").delete().eq("id", parsedProjectId);
  projectDeleteQuery = applyTenantFilter(projectDeleteQuery, tenantId);
  const { error: projectDeleteError } = await projectDeleteQuery;
  if (projectDeleteError) {
    console.error("Error deleting project:", projectDeleteError);
    throw new Error("Failed to delete project. Hide it instead if records are linked.");
  }

  return true;
}

/**
 * Create budget entries for an IGA project
 */
export async function createIgaBudgetEntries(projectId, entries = [], tenantId) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  const parsedProjectId = Number.parseInt(String(projectId), 10);
  if (!Number.isInteger(parsedProjectId) || parsedProjectId <= 0) {
    throw new Error("Invalid project id");
  }

  if (!Array.isArray(entries) || entries.length === 0) {
    return [];
  }

  const insertPayload = entries
    .map((entry) => {
      const item = normalizeOptional(entry?.item);
      const notes = normalizeOptional(entry?.notes);
      const date = normalizeOptional(entry?.date);

      const plannedRaw = entry?.planned_amount;
      const actualRaw = entry?.actual_amount;
      const plannedAmount =
        plannedRaw === undefined || plannedRaw === null || plannedRaw === ""
          ? null
          : Number(plannedRaw);
      const actualAmount =
        actualRaw === undefined || actualRaw === null || actualRaw === ""
          ? null
          : Number(actualRaw);

      if (plannedAmount !== null && !Number.isFinite(plannedAmount)) {
        throw new Error("Invalid planned amount");
      }
      if (actualAmount !== null && !Number.isFinite(actualAmount)) {
        throw new Error("Invalid actual amount");
      }

      return {
        project_id: parsedProjectId,
        item,
        planned_amount: plannedAmount,
        actual_amount: actualAmount,
        date,
        notes,
        tenant_id: tenantId ?? null,
      };
    })
    .filter(
      (entry) =>
        entry.item ||
        entry.notes ||
        entry.date ||
        entry.planned_amount !== null ||
        entry.actual_amount !== null
    );

  if (insertPayload.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("iga_budgets")
    .insert(insertPayload)
    .select("*");

  if (error) {
    console.error("Error creating budget entries:", error);
    if (error.code === "42501") {
      throw new Error("You do not have permission to save budget details.");
    }
    throw new Error("Failed to save project budget details");
  }

  return data || [];
}

/**
 * Join an IGA project
 */
export async function joinProject(projectId, memberId, tenantId) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  // Check if already a member
  let existingQuery = supabase
    .from("iga_committee_members")
    .select("id")
    .eq("project_id", projectId)
    .eq("member_id", memberId);
  existingQuery = applyTenantFilter(existingQuery, tenantId);
  const { data: existing } = await existingQuery.single();

  if (existing) {
    throw new Error("You are already a member of this project");
  }

  const { data, error } = await supabase
    .from("iga_committee_members")
    .insert({
      project_id: projectId,
      member_id: memberId,
      role: "Member",
      term_start: new Date().toISOString().split("T")[0],
      tenant_id: tenantId ?? null,
    })
    .select()
    .single();

  if (error) {
    console.error("Error joining project:", error);
    throw new Error("Failed to join project");
  }

  return data;
}

/**
 * Leave an IGA project
 */
export async function leaveProject(projectId, memberId, tenantId) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  let deleteQuery = supabase
    .from("iga_committee_members")
    .delete()
    .eq("project_id", projectId)
    .eq("member_id", memberId);
  deleteQuery = applyTenantFilter(deleteQuery, tenantId);
  const { error } = await deleteQuery;

  if (error) {
    console.error("Error leaving project:", error);
    throw new Error("Failed to leave project");
  }

  return true;
}

/**
 * Get JPP batches
 */
export async function getJppBatches(tenantId, projectId) {
  const mockBatches = [
    {
      id: 1,
      batch_code: "JPP-2026-01-A",
      batch_name: "Brooder A",
      start_date: "2026-01-05",
      supplier_name: "Kisumu Hatchery",
      bird_type: "Broiler",
      breed: "Kuroiler",
      starting_count: 350,
      feed_on_hand_kg: 120,
    },
    {
      id: 2,
      batch_code: "JPP-2026-02-B",
      batch_name: "Grower Pen 2",
      start_date: "2026-02-10",
      supplier_name: "Homa Bay Chicks",
      bird_type: "Layer",
      breed: "Sasso",
      starting_count: 280,
      feed_on_hand_kg: 85,
    },
  ];

  if (!isSupabaseConfigured || !supabase) return mockBatches;

  let query = supabase
    .from("jpp_batches")
    .select("*")
    .order("start_date", { ascending: false });
  if (projectId) {
    query = query.eq("project_id", projectId);
  }
  query = applyTenantFilter(query, tenantId);
  const { data, error } = await query;

  if (error) {
    console.error("Error fetching JPP batches:", error);
    throw error;
  }

  return data || [];
}

/**
 * Get JPP batch KPIs
 */
export async function getJppBatchKpis(tenantId, projectId) {
  const mockKpis = [
    {
      batch_code: "JPP-2026-01-A",
      batch_name: "Brooder A",
      start_date: "2026-01-05",
      starting_count: 350,
      total_deaths: 8,
      estimated_alive_now: 342,
      mortality_pct: 2.29,
      total_feed_kg: 520.5,
      total_spend: 215000,
    },
    {
      batch_code: "JPP-2026-02-B",
      batch_name: "Grower Pen 2",
      start_date: "2026-02-10",
      starting_count: 280,
      total_deaths: 4,
      estimated_alive_now: 276,
      mortality_pct: 1.43,
      total_feed_kg: 310.2,
      total_spend: 142500,
    },
  ];

  if (!isSupabaseConfigured || !supabase) return mockKpis;

  let query = supabase
    .from("v_jpp_batch_kpis")
    .select("*")
    .order("start_date", { ascending: false });
  if (projectId) {
    query = query.eq("project_id", projectId);
  }
  query = applyTenantFilter(query, tenantId);
  const { data, error } = await query;

  if (error) {
    console.error("Error fetching JPP batch KPIs:", error);
    return [];
  }

  return data || [];
}

/**
 * Get JPP module counts
 */
export async function getJppModuleCounts(tenantId, projectId) {
  const mockCounts = { dailyLogs: 18, weeklyGrowth: 4, expenses: 12 };

  if (!isSupabaseConfigured || !supabase) return mockCounts;

  try {
    const resolvedProjectId = await resolveModuleProjectId("jpp", tenantId, projectId);
    const [dailyRes, weeklyRes, expensesRes] = await Promise.all([
      applyTenantFilter(
        supabase
          .from("jpp_daily_log")
          .select("*", { count: "exact", head: true })
          .eq("project_id", resolvedProjectId),
        tenantId
      ),
      applyTenantFilter(
        supabase
          .from("jpp_weekly_growth")
          .select("*", { count: "exact", head: true })
          .eq("project_id", resolvedProjectId),
        tenantId
      ),
      applyTenantFilter(
        supabase
          .from("project_expenses")
          .select("*", { count: "exact", head: true })
          .eq("project_id", resolvedProjectId),
        tenantId
      ),
    ]);

    return {
      dailyLogs: dailyRes.count || 0,
      weeklyGrowth: weeklyRes.count || 0,
      expenses: expensesRes.count || 0,
    };
  } catch (error) {
    console.error("Error fetching JPP module counts:", error);
    return { dailyLogs: 0, weeklyGrowth: 0, expenses: 0 };
  }
}

/**
 * Get JPP daily logs
 */
export async function getJppDailyLogs(tenantId, projectId) {
  const mockDailyLogs = [
    {
      id: 1,
      batch_id: 1,
      log_date: "2026-03-01",
      water_clean_full_am: true,
      feed_given_am: true,
      feed_given_pm: true,
      droppings_normal: true,
      temp_vent_ok: true,
      cleaned_drinkers: true,
      cleaned_feeders: false,
      predator_check_done: true,
      alive_count: 342,
      deaths_today: 1,
      death_cause_code: "U",
      feed_used_kg: 18.5,
      water_refills: 4,
      eggs_collected: 0,
      money_spent: 1200,
      notes: "Regular feeding and checks.",
    },
    {
      id: 2,
      batch_id: 2,
      log_date: "2026-03-02",
      water_clean_full_am: true,
      feed_given_am: true,
      feed_given_pm: false,
      droppings_normal: true,
      temp_vent_ok: true,
      cleaned_drinkers: true,
      cleaned_feeders: true,
      predator_check_done: true,
      alive_count: 276,
      deaths_today: 0,
      death_cause_code: null,
      feed_used_kg: 14.2,
      water_refills: 3,
      eggs_collected: 0,
      money_spent: 0,
      notes: "",
    },
  ];

  if (!isSupabaseConfigured || !supabase) return mockDailyLogs;

  let query = supabase
    .from("jpp_daily_log")
    .select("*")
    .order("log_date", { ascending: false });
  if (projectId) {
    query = query.eq("project_id", projectId);
  }
  query = applyTenantFilter(query, tenantId);
  const { data, error } = await query;

  if (error) {
    console.error("Error fetching JPP daily logs:", error);
    throw error;
  }

  return data || [];
}

/**
 * Get JPP weekly growth logs
 */
export async function getJppWeeklyGrowth(tenantId, projectId) {
  const mockWeekly = [
    {
      id: 1,
      batch_id: 1,
      week_ending: "2026-03-02",
      sample_size: 20,
      avg_weight_kg: 1.8,
      min_weight_kg: 1.2,
      max_weight_kg: 2.3,
      body_score_avg: 3.6,
      feed_used_week_kg: 95,
      meds_given: "Vitamin boost",
      birds_sold: 0,
      birds_culled: 1,
      notes: "Weights improving.",
    },
  ];

  if (!isSupabaseConfigured || !supabase) return mockWeekly;

  let query = supabase
    .from("jpp_weekly_growth")
    .select("*")
    .order("week_ending", { ascending: false });
  if (projectId) {
    query = query.eq("project_id", projectId);
  }
  query = applyTenantFilter(query, tenantId);
  const { data, error } = await query;

  if (error) {
    console.error("Error fetching JPP weekly growth:", error);
    throw error;
  }

  return data || [];
}

/**
 * Get JPP birds
 */
export async function getJppBirds(tenantId, projectId) {
  const mockBirds = [
    {
      id: "mock-bird-1",
      product_id: "mock-jpp-birds",
      batch_id: null,
      tag_id: "JPP-001",
      bird_name: "JPP-001",
      sex: "female",
      breed_label: "kienyeji",
      hatch_date: "2026-02-01",
      acquired_date: "2026-02-10",
      acquired_source: "hatched",
      status: "alive",
      status_date: "2026-02-10",
      photo_url: "",
      notes: "",
      description: "Healthy starter hen for growth tracking.",
      color_label: "Brown",
      pattern_label: "Speckled",
      age_stage: "pullet",
      last_log_date: "2026-02-20",
      feed_per_bird_kg: 0.14,
      water_refills_per_bird: 0.5,
      eggs_per_bird: 0,
      spend_per_bird: 32,
      daily_bird_count: 7,
      daily_alive_count: 7,
      last_week_ending: "2026-02-23",
      feed_per_bird_week_kg: 0.85,
      birds_sold_per_bird: 0,
      birds_culled_per_bird: 0,
      weekly_bird_count: 7,
    },
  ];

  if (!isSupabaseConfigured || !supabase) return mockBirds;

  let query = supabase
    .from("v_jpp_bird_cards")
    .select("*")
    .order("created_at", { ascending: false });
  if (projectId) {
    query = query.eq("project_id", projectId);
  }
  query = applyTenantFilter(query, tenantId);
  let { data, error } = await query;

  if (error) {
    let fallbackQuery = supabase
      .from("jpp_birds")
      .select("*")
      .order("created_at", { ascending: false });
    if (projectId) {
      fallbackQuery = fallbackQuery.eq("project_id", projectId);
    }
    fallbackQuery = applyTenantFilter(fallbackQuery, tenantId);
    const fallback = await fallbackQuery;
    if (fallback.error) {
      console.error("Error fetching JPP birds:", fallback.error);
      throw fallback.error;
    }
    data = fallback.data;
  }

  const rows = data || [];
  const resolved = await Promise.all(
    rows.map(async (bird) => {
      if (!bird.photo_url) {
        return bird;
      }
      const resolvedUrl = await resolveBirdPhotoUrl(bird.photo_url);
      if (!resolvedUrl) {
        return bird;
      }
      return { ...bird, photo_url: resolvedUrl };
    })
  );

  return resolved;
}

async function resolveBirdPhotoUrl(value) {
  if (!value || !isSupabaseConfigured || !supabase) {
    return value;
  }

  const raw = String(value);
  let path = raw;

  if (raw.startsWith("http")) {
    const publicMarker = "/storage/v1/object/public/birds/";
    const signedMarker = "/storage/v1/object/sign/birds/";
    if (raw.includes(publicMarker)) {
      path = raw.split(publicMarker)[1];
    } else if (raw.includes(signedMarker)) {
      path = raw.split(signedMarker)[1];
    } else {
      return raw;
    }

    if (path.includes("?")) {
      path = path.split("?")[0];
    }
  }

  if (!path) {
    return raw;
  }

  const { data: signedData, error: signedError } = await supabase.storage
    .from("birds")
    .createSignedUrl(path, 60 * 60);

  if (!signedError && signedData?.signedUrl) {
    return signedData.signedUrl;
  }

  const { data: publicData } = supabase.storage.from("birds").getPublicUrl(path);
  return publicData?.publicUrl || raw;
}

/**
 * Get project expenses (by project code or id)
 */
export async function getProjectExpenses(projectRef, tenantId) {
  const mockExpenses = [
    {
      id: 1,
      batch_id: null,
      expense_date: "2026-03-01",
      category: "Feed",
      amount: 12500,
      vendor: "Kosele Feeds",
      description: "Starter feed",
      receipt: true,
    },
    {
      id: 2,
      batch_id: null,
      expense_date: "2026-03-02",
      category: "Utilities",
      amount: 2500,
      vendor: "PowerCo",
      description: "Brooder electricity",
      receipt: false,
    },
  ];

  if (!isSupabaseConfigured || !supabase) return mockExpenses;

  const projectId = await resolveProjectId(projectRef, tenantId);
  let query = supabase
    .from("project_expenses")
    .select("*")
    .eq("project_id", projectId)
    .order("expense_date", { ascending: false });
  query = applyTenantFilter(query, tenantId);
  const { data, error } = await query;

  if (error) {
    console.error("Error fetching project expenses:", error);
    throw error;
  }

  return attachExpenseReceiptSignedUrls(data || []);
}

/**
 * Get project expenses for multiple projects (by ids)
 */
export async function getProjectExpensesForProjects(projectIds, tenantId) {
  if (!projectIds || projectIds.length === 0) {
    return [];
  }

  const mockExpenses = [
    {
      id: "mock-expense-1",
      project_id: projectIds[0],
      batch_id: null,
      expense_date: "2026-03-01",
      category: "Feed",
      amount: 12500,
      vendor: "Kosele Feeds",
      description: "Starter feed",
      receipt: true,
    },
    {
      id: "mock-expense-2",
      project_id: projectIds[1] || projectIds[0],
      batch_id: null,
      expense_date: "2026-03-02",
      category: "Utilities",
      amount: 2500,
      vendor: "PowerCo",
      description: "Brooder electricity",
      receipt: false,
    },
  ];

  if (!isSupabaseConfigured || !supabase) {
    return mockExpenses;
  }

  const safeIds = projectIds.filter(Boolean);
  if (safeIds.length === 0) {
    return [];
  }

  let query = supabase
    .from("project_expenses")
    .select("*")
    .in("project_id", safeIds)
    .order("expense_date", { ascending: false });
  query = applyTenantFilter(query, tenantId);
  const { data, error } = await query;

  if (error) {
    console.error("Error fetching project expenses:", error);
    throw error;
  }

  return attachExpenseReceiptSignedUrls(data || []);
}

/**
 * Get recent expenses across multiple projects
 */
export async function getRecentProjectExpenses(projectIds = [], limit = 3, tenantId) {
  if (!Array.isArray(projectIds) || projectIds.length === 0) {
    return [];
  }

  const mockExpenses = [
    {
      id: 101,
      project_id: projectIds[0],
      batch_id: null,
      expense_date: "2026-03-05",
      category: "Feed",
      amount: 4800,
      vendor: "Kosele Feeds",
      description: "Starter feed",
      receipt: true,
    },
    {
      id: 102,
      project_id: projectIds[1] || projectIds[0],
      batch_id: null,
      expense_date: "2026-03-04",
      category: "Utilities",
      amount: 1500,
      vendor: "PowerCo",
      description: "Electricity",
      receipt: false,
    },
    {
      id: 103,
      project_id: projectIds[0],
      batch_id: null,
      expense_date: "2026-03-03",
      category: "Supplements",
      amount: 2300,
      vendor: "AgroVet",
      description: "Vitamins",
      receipt: true,
    },
  ];

  const safeLimit = Math.max(1, Number(limit) || 3);

  if (!isSupabaseConfigured || !supabase) {
    return mockExpenses.slice(0, safeLimit);
  }

  let query = supabase
    .from("project_expenses")
    .select("*")
    .in("project_id", projectIds)
    .order("expense_date", { ascending: false })
    .limit(safeLimit);
  query = applyTenantFilter(query, tenantId);
  const { data, error } = await query;

  if (error) {
    console.error("Error fetching recent project expenses:", error);
    throw error;
  }

  return attachExpenseReceiptSignedUrls(data || []);
}

async function attachExpenseReceiptSignedUrls(rows = []) {
  if (!isSupabaseConfigured || !supabase || !Array.isArray(rows) || rows.length === 0) {
    return rows || [];
  }

  const signedUrlMap = new Map();
  const uniquePaths = Array.from(
    new Set(
      rows
        .map((row) => String(row?.receipt_file_path || "").trim())
        .filter(Boolean)
    )
  );

  await Promise.all(
    uniquePaths.map(async (path) => {
      const { data: signedData, error: signedError } = await supabase.storage
        .from(PROJECT_DOCUMENT_BUCKET)
        .createSignedUrl(path, 60 * 60);
      if (signedError) {
        console.warn("Error creating signed URL for expense receipt:", signedError);
        return;
      }
      signedUrlMap.set(path, signedData?.signedUrl || null);
    })
  );

  return rows.map((row) => {
    const path = String(row?.receipt_file_path || "").trim();
    return {
      ...row,
      receipt_download_url:
        (path ? signedUrlMap.get(path) : null) || row?.receipt_file_url || null,
    };
  });
}

/**
 * Get project sales (by project code or id)
 */
export async function getProjectSales(projectRef, tenantId) {
  const mockSales = [
    {
      id: 1,
      batch_id: null,
      sale_date: "2026-01-12",
      product_type: "peanut_butter",
      quantity_units: 20,
      unit_price: 350,
      total_amount: 7000,
      customer_name: "Kosele Market",
      customer_type: "retail",
      payment_status: "paid",
    },
  ];

  if (!isSupabaseConfigured || !supabase) return mockSales;

  const projectId = await resolveProjectId(projectRef, tenantId);
  let query = supabase
    .from("project_sales")
    .select("*")
    .eq("project_id", projectId)
    .order("sale_date", { ascending: false });
  query = applyTenantFilter(query, tenantId);
  const { data, error } = await query;

  if (error) {
    console.error("Error fetching project sales:", error);
    throw error;
  }

  return data || [];
}

/**
 * Get project sales for multiple projects (by ids)
 */
export async function getProjectSalesForProjects(projectIds, tenantId) {
  if (!projectIds || projectIds.length === 0) {
    return [];
  }

  const mockSales = [
    {
      id: "mock-sale-1",
      project_id: projectIds[0],
      batch_id: null,
      sale_date: "2026-01-12",
      product_type: "peanut_butter",
      quantity_units: 20,
      unit_price: 350,
      total_amount: 7000,
      customer_name: "Kosele Market",
      customer_type: "retail",
      payment_status: "paid",
    },
  ];

  if (!isSupabaseConfigured || !supabase) {
    return mockSales;
  }

  const safeIds = projectIds.filter(Boolean);
  if (safeIds.length === 0) {
    return [];
  }

  let query = supabase
    .from("project_sales")
    .select("*")
    .in("project_id", safeIds)
    .order("sale_date", { ascending: false });
  query = applyTenantFilter(query, tenantId);
  const { data, error } = await query;

  if (error) {
    console.error("Error fetching project sales:", error);
    throw error;
  }

  return data || [];
}

/**
 * Get project products (by project code or id)
 */
export async function getProjectProducts(projectRef, options = {}, tenantId) {
  const mockProducts = [
    {
      id: "mock-jpp-birds",
      name: "Live Birds",
      category: "livestock",
      tracking_mode: "individual",
      unit: "birds",
      is_active: true,
    },
    {
      id: "mock-jpp-eggs",
      name: "Eggs",
      category: "eggs",
      tracking_mode: "bulk",
      unit: "trays",
      is_active: true,
    },
  ];

  if (!isSupabaseConfigured || !supabase) {
    if (options.trackingMode) {
      return mockProducts.filter((item) => item.tracking_mode === options.trackingMode);
    }
    return mockProducts;
  }

  const projectId = await resolveProjectId(projectRef, tenantId);
  let query = supabase
    .from("project_products")
    .select("id, name, category, tracking_mode, unit, is_active")
    .eq("project_id", projectId)
    .eq("is_active", true)
    .order("name", { ascending: true });
  query = applyTenantFilter(query, tenantId);

  if (options.trackingMode) {
    query = query.eq("tracking_mode", options.trackingMode);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching project products:", error);
    throw error;
  }

  return data || [];
}

/**
 * Get JPP expenses
 */
export async function getJppExpenses(tenantId, projectId) {
  return getProjectExpenses(projectId ?? "jpp", tenantId);
}

const MODULE_KEYS = new Set(["jpp", "jgf", "generic"]);

const resolveModuleKey = (value) => {
  if (!value) return null;
  const lower = String(value).trim().toLowerCase();
  if (MODULE_KEYS.has(lower)) {
    return lower;
  }
  const upper = String(value).trim().toUpperCase();
  if (upper === "JPP") return "jpp";
  if (upper === "JGF") return "jgf";
  return null;
};

async function resolveProjectId(projectRef, tenantId) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  if (projectRef === null || projectRef === undefined) {
    throw new Error("Project is required");
  }

  if (typeof projectRef === "number") {
    return projectRef;
  }

  const trimmed = String(projectRef).trim();
  if (!trimmed) {
    throw new Error("Project is required");
  }

  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed);
  }

  const moduleKey = resolveModuleKey(trimmed);
  if (moduleKey) {
    if (!tenantId) {
      throw new Error("Tenant is required to resolve module projects.");
    }
    let moduleQuery = supabase
      .from("iga_projects")
      .select("id")
      .eq("module_key", moduleKey)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(1);
    moduleQuery = applyTenantFilter(moduleQuery, tenantId);
    let { data: moduleProject, error: moduleError } = await moduleQuery.maybeSingle();

    // Older schemas may not yet have module_key. Fall back to code lookup.
    if (moduleError && isMissingColumnError(moduleError, "module_key")) {
      let fallbackQuery = supabase
        .from("iga_projects")
        .select("id")
        .eq("code", moduleKey.toUpperCase())
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: true })
        .limit(1);
      fallbackQuery = applyTenantFilter(fallbackQuery, tenantId);
      ({ data: moduleProject, error: moduleError } = await fallbackQuery.maybeSingle());
    }

    if (moduleError) {
      console.error("Error fetching project by module_key:", moduleError);
      throw moduleError;
    }

    if (!moduleProject) {
      throw new Error(`Project not found for module ${moduleKey}.`);
    }

    return moduleProject.id;
  }

  const projectCode = trimmed.toUpperCase();
  let query = supabase.from("iga_projects").select("id").eq("code", projectCode);
  query = applyTenantFilter(query, tenantId);
  const { data: project, error } = await query.maybeSingle();

  if (error) {
    console.error("Error fetching project by code:", error);
    throw error;
  }

  if (!project) {
    throw new Error(`Project not found for code ${projectCode}.`);
  }

  return project.id;
}

async function resolveModuleProjectId(moduleKey, tenantId, projectId) {
  if (projectId) {
    return projectId;
  }
  return resolveProjectId(moduleKey, tenantId);
}

/**
 * Get project expense items (by project code or id)
 */
export async function getProjectExpenseItems(projectRef, tenantId) {
  const mockItems = [
    { id: 1, label: "Layer feed (mash)", category: "Feed", display_order: 1 },
    { id: 2, label: "Supplements (grit/oyster shell)", category: "Feed", display_order: 2 },
    { id: 3, label: "Vitamins/minerals", category: "Meds", display_order: 3 },
    { id: 4, label: "Vaccines/meds", category: "Meds", display_order: 4 },
    { id: 5, label: "Litter/bedding", category: "Bedding", display_order: 5 },
    { id: 6, label: "Disinfectant/cleaning", category: "Other", display_order: 6 },
    { id: 7, label: "Egg trays/packaging", category: "Other", display_order: 7 },
    { id: 8, label: "Electricity", category: "Utilities", display_order: 8 },
    { id: 9, label: "Water", category: "Utilities", display_order: 9 },
    { id: 10, label: "Transport/fuel", category: "Transport", display_order: 10 },
    { id: 11, label: "Repairs/maintenance", category: "Repairs", display_order: 11 },
    { id: 12, label: "Wages/labor", category: "Labour", display_order: 12 },
    { id: 13, label: "Pest control", category: "Other", display_order: 13 },
    { id: 14, label: "Generator fuel/LPG", category: "Utilities", display_order: 14 },
    { id: 15, label: "Vet services", category: "Meds", display_order: 15 },
    { id: 16, label: "Equipment replacement", category: "Repairs", display_order: 16 },
    { id: 17, label: "Waste disposal", category: "Utilities", display_order: 17 },
    { id: 18, label: "Security", category: "Other", display_order: 18 },
    { id: 19, label: "Phone/data", category: "Utilities", display_order: 19 },
    { id: 20, label: "Licenses/permits", category: "Other", display_order: 20 },
    { id: 21, label: "Insurance", category: "Other", display_order: 21 },
    { id: 22, label: "Bank/mobile money fees", category: "Other", display_order: 22 },
  ];

  if (!isSupabaseConfigured || !supabase) return mockItems;

  const projectId = await resolveProjectId(projectRef, tenantId);

  let query = supabase
    .from("project_expense_items")
    .select("id, label, category, display_order, is_active")
    .eq("project_id", projectId)
    .eq("is_active", true)
    .order("display_order", { ascending: true });
  query = applyTenantFilter(query, tenantId);
  const { data, error } = await query;

  if (error) {
    console.error("Error fetching project expense items:", error);
    throw error;
  }

  return data || [];
}

export async function getProjectExpenseCategories(projectRef, tenantId) {
  const normalizedCode = projectRef ? String(projectRef).trim().toUpperCase() : "";
  const mockCategoriesByProject = {
    JPP: [
      "Feed",
      "Meds",
      "Bedding",
      "Labour",
      "Repairs",
      "Transport",
      "Utilities",
      "Other",
    ],
    JGF: [
      "Raw Materials",
      "Packaging",
      "Labour",
      "Equipment",
      "Transport",
      "Utilities",
      "Marketing",
      "Other",
    ],
  };

  if (!isSupabaseConfigured || !supabase) {
    return mockCategoriesByProject[normalizedCode] || [];
  }

  const projectId = await resolveProjectId(projectRef, tenantId);

  let query = supabase
    .from("project_expense_items")
    .select("category, display_order")
    .eq("project_id", projectId)
    .eq("is_active", true)
    .not("category", "is", null)
    .order("display_order", { ascending: true });
  query = applyTenantFilter(query, tenantId);
  const { data, error } = await query;

  if (error) {
    console.error("Error fetching project expense categories:", error);
    throw error;
  }

  const categories = [];
  const seen = new Set();
  (data || []).forEach((row) => {
    const category = row.category;
    if (!category || seen.has(category)) {
      return;
    }
    seen.add(category);
    categories.push(category);
  });

  return categories;
}

export async function getProjectExpenseCategoryDefinitions(projectRef, tenantId) {
  if (!isSupabaseConfigured || !supabase) {
    const fallback = await getProjectExpenseCategories(projectRef, tenantId);
    return (fallback || []).map((name, index) => ({
      id: `fallback-${index}-${String(name).toLowerCase().replace(/\s+/g, "-")}`,
      project_id: null,
      name,
      display_order: index,
      archived_at: null,
      created_at: null,
      updated_at: null,
    }));
  }

  const projectId = await resolveProjectId(projectRef, tenantId);

  let query = supabase
    .from("project_expense_categories")
    .select("id, project_id, tenant_id, name, display_order, archived_at, created_at, updated_at")
    .eq("project_id", projectId)
    .is("archived_at", null)
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });
  query = applyTenantFilter(query, tenantId);
  let { data, error } = await query;

  if (error && isMissingRelationError(error, "project_expense_categories")) {
    const fallback = await getProjectExpenseCategories(projectRef, tenantId);
    return (fallback || []).map((name, index) => ({
      id: `fallback-${index}-${String(name).toLowerCase().replace(/\s+/g, "-")}`,
      project_id: projectId,
      name,
      display_order: index,
      archived_at: null,
      created_at: null,
      updated_at: null,
    }));
  }

  if (error) {
    console.error("Error fetching project expense category definitions:", error);
    throw error;
  }

  return data || [];
}

const normalizeTaskPriority = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (normalized === "urgent" || normalized === "high" || normalized === "normal") {
    return normalized;
  }
  return "normal";
};

const normalizeTaskStatus = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (
    normalized === "open" ||
    normalized === "in_progress" ||
    normalized === "done" ||
    normalized === "cancelled"
  ) {
    return normalized;
  }
  if (normalized === "in progress") return "in_progress";
  if (normalized === "completed") return "done";
  if (normalized === "canceled") return "cancelled";
  return "open";
};

const normalizeNoteVisibility = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (normalized === "admins_only" || normalized === "project_team") {
    return normalized;
  }
  if (normalized === "admins only") return "admins_only";
  if (normalized === "project team") return "project_team";
  return "project_team";
};

const parseOptionalMemberId = (value) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
};

export async function getProjectTasks(projectRef, tenantId) {
  if (!isSupabaseConfigured || !supabase) {
    return [];
  }

  const projectId = await resolveProjectId(projectRef, tenantId);

  let query = supabase
    .from("project_tasks")
    .select(
      "id, project_id, tenant_id, title, details, assignee_member_id, due_date, priority, status, created_by_member_id, completed_at, archived_at, created_at, updated_at"
    )
    .eq("project_id", projectId)
    .is("archived_at", null)
    .order("created_at", { ascending: false });
  query = applyTenantFilter(query, tenantId);
  const { data, error } = await query;

  if (error && isMissingRelationError(error, "project_tasks")) {
    throw new Error("Tasks table is not available. Run migration_044_project_tasks_notes.sql.");
  }
  if (error) {
    console.error("Error fetching project tasks:", error);
    throw error;
  }

  const tasks = Array.isArray(data) ? data : [];
  const memberIds = Array.from(
    new Set(
      tasks
        .flatMap((task) => [task?.assignee_member_id, task?.created_by_member_id])
        .map((id) => Number.parseInt(String(id ?? ""), 10))
        .filter((id) => Number.isInteger(id) && id > 0)
    )
  );
  const memberNames = new Map();

  if (memberIds.length) {
    const { data: members, error: memberError } = await supabase
      .from("members")
      .select("id, name")
      .in("id", memberIds);
    if (memberError) {
      console.warn("Error loading task member names:", memberError);
    } else {
      (members || []).forEach((member) => {
        memberNames.set(member.id, member.name || `Member #${member.id}`);
      });
    }
  }

  return tasks.map((task) => ({
    ...task,
    assignee_name: task?.assignee_member_id ? memberNames.get(task.assignee_member_id) || null : null,
    created_by_name: task?.created_by_member_id ? memberNames.get(task.created_by_member_id) || null : null,
  }));
}

export async function createProjectTask(projectRef, payload, tenantId) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  const projectId = await resolveProjectId(projectRef, tenantId);
  const title = normalizeOptional(payload?.title);
  if (!title) {
    throw new Error("Task title is required.");
  }

  const insertPayload = {
    project_id: projectId,
    tenant_id: tenantId ?? null,
    title,
    details: normalizeOptional(payload?.details),
    assignee_member_id: parseOptionalMemberId(payload?.assignee_member_id),
    due_date: normalizeOptional(payload?.due_date),
    priority: normalizeTaskPriority(payload?.priority),
    status: normalizeTaskStatus(payload?.status),
    created_by_member_id: parseOptionalMemberId(payload?.created_by_member_id),
  };

  const { data, error } = await supabase
    .from("project_tasks")
    .insert(insertPayload)
    .select(
      "id, project_id, tenant_id, title, details, assignee_member_id, due_date, priority, status, created_by_member_id, completed_at, archived_at, created_at, updated_at"
    )
    .single();

  if (error && isMissingRelationError(error, "project_tasks")) {
    throw new Error("Tasks table is not available. Run migration_044_project_tasks_notes.sql.");
  }
  if (error) {
    console.error("Error creating project task:", error);
    throw error;
  }

  return data;
}

export async function updateProjectTask(taskId, payload, tenantId) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  const parsedTaskId = String(taskId || "").trim();
  if (!parsedTaskId) {
    throw new Error("Task id is required.");
  }

  const updatePayload = {};
  if ("title" in payload) updatePayload.title = normalizeOptional(payload?.title);
  if ("details" in payload) updatePayload.details = normalizeOptional(payload?.details);
  if ("assignee_member_id" in payload) {
    updatePayload.assignee_member_id = parseOptionalMemberId(payload?.assignee_member_id);
  }
  if ("due_date" in payload) updatePayload.due_date = normalizeOptional(payload?.due_date);
  if ("priority" in payload) updatePayload.priority = normalizeTaskPriority(payload?.priority);
  if ("status" in payload) updatePayload.status = normalizeTaskStatus(payload?.status);
  if ("created_by_member_id" in payload) {
    updatePayload.created_by_member_id = parseOptionalMemberId(payload?.created_by_member_id);
  }
  if ("completed_at" in payload) updatePayload.completed_at = normalizeOptional(payload?.completed_at);

  if (Object.keys(updatePayload).length === 0) {
    throw new Error("No fields to update.");
  }

  updatePayload.updated_at = new Date().toISOString();

  let query = supabase
    .from("project_tasks")
    .update(updatePayload)
    .eq("id", parsedTaskId);
  query = applyTenantFilter(query, tenantId);
  const { data, error } = await query
    .select(
      "id, project_id, tenant_id, title, details, assignee_member_id, due_date, priority, status, created_by_member_id, completed_at, archived_at, created_at, updated_at"
    )
    .single();

  if (error && isMissingRelationError(error, "project_tasks")) {
    throw new Error("Tasks table is not available. Run migration_044_project_tasks_notes.sql.");
  }
  if (error) {
    console.error("Error updating project task:", error);
    throw error;
  }

  return data;
}

export async function deleteProjectTask(taskId, tenantId) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  const parsedTaskId = String(taskId || "").trim();
  if (!parsedTaskId) {
    throw new Error("Task id is required.");
  }

  let query = supabase
    .from("project_tasks")
    .delete()
    .eq("id", parsedTaskId);
  query = applyTenantFilter(query, tenantId);
  const { error } = await query;

  if (error && isMissingRelationError(error, "project_tasks")) {
    throw new Error("Tasks table is not available. Run migration_044_project_tasks_notes.sql.");
  }
  if (error) {
    console.error("Error deleting project task:", error);
    throw error;
  }

  return true;
}

export async function getProjectNotes(projectRef, tenantId) {
  if (!isSupabaseConfigured || !supabase) {
    return [];
  }

  const projectId = await resolveProjectId(projectRef, tenantId);

  let query = supabase
    .from("project_notes")
    .select("id, project_id, tenant_id, title, body, visibility, author_member_id, pinned, archived_at, created_at, updated_at")
    .eq("project_id", projectId)
    .is("archived_at", null)
    .order("created_at", { ascending: false });
  query = applyTenantFilter(query, tenantId);
  const { data, error } = await query;

  if (error && isMissingRelationError(error, "project_notes")) {
    throw new Error("Notes table is not available. Run migration_044_project_tasks_notes.sql.");
  }
  if (error) {
    console.error("Error fetching project notes:", error);
    throw error;
  }

  const notes = Array.isArray(data) ? data : [];
  const memberIds = Array.from(
    new Set(
      notes
        .map((note) => Number.parseInt(String(note?.author_member_id ?? ""), 10))
        .filter((id) => Number.isInteger(id) && id > 0)
    )
  );
  const memberNames = new Map();
  if (memberIds.length) {
    const { data: members, error: memberError } = await supabase
      .from("members")
      .select("id, name")
      .in("id", memberIds);
    if (memberError) {
      console.warn("Error loading note author names:", memberError);
    } else {
      (members || []).forEach((member) => {
        memberNames.set(member.id, member.name || `Member #${member.id}`);
      });
    }
  }

  return notes.map((note) => ({
    ...note,
    author_name: note?.author_member_id ? memberNames.get(note.author_member_id) || null : null,
  }));
}

export async function createProjectNote(projectRef, payload, tenantId) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  const projectId = await resolveProjectId(projectRef, tenantId);
  const title = normalizeOptional(payload?.title);
  if (!title) {
    throw new Error("Note title is required.");
  }

  const insertPayload = {
    project_id: projectId,
    tenant_id: tenantId ?? null,
    title,
    body: normalizeOptional(payload?.body),
    visibility: normalizeNoteVisibility(payload?.visibility),
    author_member_id: parseOptionalMemberId(payload?.author_member_id),
    pinned: Boolean(payload?.pinned),
  };

  const { data, error } = await supabase
    .from("project_notes")
    .insert(insertPayload)
    .select("id, project_id, tenant_id, title, body, visibility, author_member_id, pinned, archived_at, created_at, updated_at")
    .single();

  if (error && isMissingRelationError(error, "project_notes")) {
    throw new Error("Notes table is not available. Run migration_044_project_tasks_notes.sql.");
  }
  if (error) {
    console.error("Error creating project note:", error);
    throw error;
  }

  return data;
}

export async function updateProjectNote(noteId, payload, tenantId) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  const parsedNoteId = String(noteId || "").trim();
  if (!parsedNoteId) {
    throw new Error("Note id is required.");
  }

  const updatePayload = {};
  if ("title" in payload) updatePayload.title = normalizeOptional(payload?.title);
  if ("body" in payload) updatePayload.body = normalizeOptional(payload?.body);
  if ("visibility" in payload) updatePayload.visibility = normalizeNoteVisibility(payload?.visibility);
  if ("author_member_id" in payload) {
    updatePayload.author_member_id = parseOptionalMemberId(payload?.author_member_id);
  }
  if ("pinned" in payload) updatePayload.pinned = Boolean(payload?.pinned);

  if (Object.keys(updatePayload).length === 0) {
    throw new Error("No fields to update.");
  }

  updatePayload.updated_at = new Date().toISOString();

  let query = supabase
    .from("project_notes")
    .update(updatePayload)
    .eq("id", parsedNoteId);
  query = applyTenantFilter(query, tenantId);
  const { data, error } = await query
    .select("id, project_id, tenant_id, title, body, visibility, author_member_id, pinned, archived_at, created_at, updated_at")
    .single();

  if (error && isMissingRelationError(error, "project_notes")) {
    throw new Error("Notes table is not available. Run migration_044_project_tasks_notes.sql.");
  }
  if (error) {
    console.error("Error updating project note:", error);
    throw error;
  }

  return data;
}

export async function deleteProjectNote(noteId, tenantId) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  const parsedNoteId = String(noteId || "").trim();
  if (!parsedNoteId) {
    throw new Error("Note id is required.");
  }

  let query = supabase
    .from("project_notes")
    .delete()
    .eq("id", parsedNoteId);
  query = applyTenantFilter(query, tenantId);
  const { error } = await query;

  if (error && isMissingRelationError(error, "project_notes")) {
    throw new Error("Notes table is not available. Run migration_044_project_tasks_notes.sql.");
  }
  if (error) {
    console.error("Error deleting project note:", error);
    throw error;
  }

  return true;
}

export async function createProjectExpenseCategory(projectRef, payload, tenantId) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  const projectId = await resolveProjectId(projectRef, tenantId);
  const name = normalizeOptional(payload?.name);
  if (!name) {
    throw new Error("Category name is required");
  }
  const normalizedName = String(name).trim();

  let existingQuery = supabase
    .from("project_expense_categories")
    .select("id, project_id, tenant_id, name, display_order, archived_at, created_at, updated_at")
    .eq("project_id", projectId)
    .is("archived_at", null)
    .ilike("name", normalizedName)
    .limit(1);
  existingQuery = applyTenantFilter(existingQuery, tenantId);
  const { data: existingRows, error: existingError } = await existingQuery;

  if (existingError && isMissingRelationError(existingError, "project_expense_categories")) {
    throw new Error(
      "Expense categories table is not available. Run migration_043_project_expense_categories.sql."
    );
  }
  if (existingError) {
    console.error("Error checking existing expense category:", existingError);
    throw existingError;
  }
  if (existingRows?.length) {
    throw new Error(`Category "${normalizedName}" already exists.`);
  }

  let displayOrder = Number(payload?.display_order);
  if (!Number.isFinite(displayOrder)) {
    let orderQuery = supabase
      .from("project_expense_categories")
      .select("display_order")
      .eq("project_id", projectId)
      .is("archived_at", null)
      .order("display_order", { ascending: false })
      .limit(1);
    orderQuery = applyTenantFilter(orderQuery, tenantId);
    const { data: orderRows, error: orderError } = await orderQuery;
    if (orderError && isMissingRelationError(orderError, "project_expense_categories")) {
      throw new Error(
        "Expense categories table is not available. Run migration_043_project_expense_categories.sql."
      );
    }
    if (orderError) {
      console.error("Error resolving expense category order:", orderError);
      throw orderError;
    }
    displayOrder = Number(orderRows?.[0]?.display_order ?? -1) + 1;
    if (!Number.isFinite(displayOrder) || displayOrder < 0) {
      displayOrder = 0;
    }
  }

  const insertPayload = {
    project_id: projectId,
    tenant_id: tenantId ?? null,
    name: normalizedName,
    display_order: displayOrder,
  };

  const { data, error } = await supabase
    .from("project_expense_categories")
    .insert(insertPayload)
    .select("id, project_id, tenant_id, name, display_order, archived_at, created_at, updated_at")
    .single();

  if (error && isMissingRelationError(error, "project_expense_categories")) {
    throw new Error(
      "Expense categories table is not available. Run migration_043_project_expense_categories.sql."
    );
  }
  if (error?.code === "23505") {
    throw new Error(`Category "${normalizedName}" already exists.`);
  }
  if (error) {
    console.error("Error creating expense category:", error);
    throw error;
  }

  return data;
}

export async function renameProjectExpenseCategory(categoryId, payload, tenantId) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  const parsedCategoryId = String(categoryId || "").trim();
  if (!parsedCategoryId) {
    throw new Error("Category id is required.");
  }

  const name = normalizeOptional(payload?.name);
  if (!name) {
    throw new Error("Category name is required");
  }
  const nextName = String(name).trim();

  let sourceQuery = supabase
    .from("project_expense_categories")
    .select("id, project_id, tenant_id, name, display_order, archived_at, created_at, updated_at")
    .eq("id", parsedCategoryId)
    .maybeSingle();
  sourceQuery = applyTenantFilter(sourceQuery, tenantId);
  const { data: sourceCategory, error: sourceError } = await sourceQuery;

  if (sourceError && isMissingRelationError(sourceError, "project_expense_categories")) {
    throw new Error(
      "Expense categories table is not available. Run migration_043_project_expense_categories.sql."
    );
  }
  if (sourceError) {
    console.error("Error loading expense category for rename:", sourceError);
    throw sourceError;
  }
  if (!sourceCategory || sourceCategory.archived_at) {
    throw new Error("Category not found.");
  }

  const previousName = String(sourceCategory.name || "").trim();
  if (previousName.toLowerCase() === nextName.toLowerCase()) {
    return sourceCategory;
  }

  let duplicateQuery = supabase
    .from("project_expense_categories")
    .select("id")
    .eq("project_id", sourceCategory.project_id)
    .is("archived_at", null)
    .ilike("name", nextName)
    .neq("id", sourceCategory.id)
    .limit(1);
  duplicateQuery = applyTenantFilter(duplicateQuery, tenantId);
  const { data: duplicateRows, error: duplicateError } = await duplicateQuery;
  if (duplicateError) {
    console.error("Error checking duplicate category on rename:", duplicateError);
    throw duplicateError;
  }
  if (duplicateRows?.length) {
    throw new Error(`Category "${nextName}" already exists.`);
  }

  const updatePayload = {
    name: nextName,
    updated_at: new Date().toISOString(),
  };
  let updateQuery = supabase
    .from("project_expense_categories")
    .update(updatePayload)
    .eq("id", sourceCategory.id);
  updateQuery = applyTenantFilter(updateQuery, tenantId);
  const { data: renamedCategory, error: renameError } = await updateQuery
    .select("id, project_id, tenant_id, name, display_order, archived_at, created_at, updated_at")
    .single();

  if (renameError) {
    console.error("Error renaming expense category:", renameError);
    throw renameError;
  }

  const shouldApplyToExpenses = payload?.applyToExpenses !== false;
  if (shouldApplyToExpenses && previousName) {
    let expenseRenameQuery = supabase
      .from("project_expenses")
      .update({
        category: nextName,
        updated_at: new Date().toISOString(),
      })
      .eq("project_id", sourceCategory.project_id)
      .ilike("category", previousName);
    expenseRenameQuery = applyTenantFilter(expenseRenameQuery, tenantId);
    const { error: expenseRenameError } = await expenseRenameQuery;

    if (expenseRenameError) {
      console.error("Category renamed but expense category sync failed:", expenseRenameError);
      throw expenseRenameError;
    }
  }

  return renamedCategory;
}

export async function archiveProjectExpenseCategory(categoryId, tenantId) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  const parsedCategoryId = String(categoryId || "").trim();
  if (!parsedCategoryId) {
    throw new Error("Category id is required.");
  }

  const archivePayload = {
    archived_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  let query = supabase
    .from("project_expense_categories")
    .update(archivePayload)
    .eq("id", parsedCategoryId)
    .is("archived_at", null);
  query = applyTenantFilter(query, tenantId);
  const { data, error } = await query
    .select("id, project_id, tenant_id, name, display_order, archived_at, created_at, updated_at")
    .single();

  if (error && isMissingRelationError(error, "project_expense_categories")) {
    throw new Error(
      "Expense categories table is not available. Run migration_043_project_expense_categories.sql."
    );
  }
  if (error) {
    console.error("Error archiving expense category:", error);
    throw error;
  }

  return data;
}

async function ensureProjectExpenseCategoryDefinition(projectId, categoryName, tenantId) {
  const normalizedCategory = normalizeOptional(categoryName);
  if (!normalizedCategory) return null;

  try {
    return await createProjectExpenseCategory(
      projectId,
      { name: normalizedCategory },
      tenantId
    );
  } catch (error) {
    const message = String(error?.message || "").toLowerCase();
    if (
      message.includes("already exists") ||
      message.includes("not available") ||
      isMissingRelationError(error, "project_expense_categories")
    ) {
      return null;
    }
    console.warn("Failed to sync expense category definition:", error);
    return null;
  }
}

export async function createProjectExpenseItem(projectRef, payload, tenantId) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  const projectId = await resolveProjectId(projectRef, tenantId);

  const label = normalizeOptional(payload.label);
  if (!label) {
    throw new Error("Expense item label is required");
  }

  const insertPayload = {
    project_id: projectId,
    label,
    category: normalizeOptional(payload.category),
    display_order: payload.display_order ?? 0,
    is_active: payload.is_active ?? true,
    tenant_id: tenantId ?? null,
  };

  const { data, error } = await supabase
    .from("project_expense_items")
    .insert(insertPayload)
    .select()
    .single();

  if (error) {
    console.error("Error creating project expense item:", error);
    throw error;
  }

  return data;
}

export async function updateProjectExpenseItem(itemId, payload, tenantId) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  const updatePayload = {};
  if ("label" in payload) updatePayload.label = normalizeOptional(payload.label);
  if ("category" in payload) updatePayload.category = normalizeOptional(payload.category);
  if ("display_order" in payload) updatePayload.display_order = payload.display_order;
  if ("is_active" in payload) updatePayload.is_active = payload.is_active;

  if (Object.keys(updatePayload).length === 0) {
    throw new Error("No fields to update");
  }

  let query = supabase
    .from("project_expense_items")
    .update(updatePayload)
    .eq("id", itemId);
  query = applyTenantFilter(query, tenantId);
  const { data, error } = await query.select().single();

  if (error) {
    console.error("Error updating project expense item:", error);
    throw error;
  }

  return data;
}

export async function createJppBatch(payload, tenantId, projectId) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  const insertPayload = {
    ...payload,
    project_id: payload?.project_id ?? projectId ?? null,
    tenant_id: tenantId ?? null,
  };

  const { data, error } = await supabase
    .from("jpp_batches")
    .insert(insertPayload)
    .select()
    .single();

  if (error) {
    console.error("Error creating JPP batch:", error);
    throw new Error("Failed to create batch");
  }

  return data;
}

export async function updateJppBatch(batchId, payload, tenantId) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  let query = supabase
    .from("jpp_batches")
    .update(payload)
    .eq("id", batchId);
  query = applyTenantFilter(query, tenantId);
  const { data, error } = await query.select().single();

  if (error) {
    console.error("Error updating JPP batch:", error);
    throw new Error("Failed to update batch");
  }

  return data;
}

export async function deleteJppBatch(batchId, tenantId) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  let query = supabase
    .from("jpp_batches")
    .delete()
    .eq("id", batchId);
  query = applyTenantFilter(query, tenantId);
  const { error } = await query;

  if (error) {
    console.error("Error deleting JPP batch:", error);
    throw new Error("Failed to delete batch");
  }

  return true;
}

export async function createJppDailyLog(payload, tenantId, projectId) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  const insertPayload = {
    ...payload,
    project_id: payload?.project_id ?? projectId ?? null,
    tenant_id: tenantId ?? null,
  };

  const { data, error } = await supabase
    .from("jpp_daily_log")
    .insert(insertPayload)
    .select()
    .single();

  if (error) {
    console.error("Error creating JPP daily log:", error);
    throw new Error("Failed to create daily log");
  }

  return data;
}

export async function updateJppDailyLog(logId, payload, tenantId) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  let query = supabase
    .from("jpp_daily_log")
    .update(payload)
    .eq("id", logId);
  query = applyTenantFilter(query, tenantId);
  const { data, error } = await query.select().single();

  if (error) {
    console.error("Error updating JPP daily log:", error);
    throw new Error("Failed to update daily log");
  }

  return data;
}

export async function deleteJppDailyLog(logId, tenantId) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  let query = supabase
    .from("jpp_daily_log")
    .delete()
    .eq("id", logId);
  query = applyTenantFilter(query, tenantId);
  const { error } = await query;

  if (error) {
    console.error("Error deleting JPP daily log:", error);
    throw new Error("Failed to delete daily log");
  }

  return true;
}

export async function createJppWeeklyGrowth(payload, tenantId, projectId) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  const insertPayload = {
    ...payload,
    project_id: payload?.project_id ?? projectId ?? null,
    tenant_id: tenantId ?? null,
  };

  const { data, error } = await supabase
    .from("jpp_weekly_growth")
    .insert(insertPayload)
    .select()
    .single();

  if (error) {
    console.error("Error creating JPP weekly growth:", error);
    throw new Error("Failed to create weekly growth entry");
  }

  return data;
}

export async function updateJppWeeklyGrowth(entryId, payload, tenantId) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  let query = supabase
    .from("jpp_weekly_growth")
    .update(payload)
    .eq("id", entryId);
  query = applyTenantFilter(query, tenantId);
  const { data, error } = await query.select().single();

  if (error) {
    console.error("Error updating JPP weekly growth:", error);
    throw new Error("Failed to update weekly growth entry");
  }

  return data;
}

export async function deleteJppWeeklyGrowth(entryId, tenantId) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  let query = supabase
    .from("jpp_weekly_growth")
    .delete()
    .eq("id", entryId);
  query = applyTenantFilter(query, tenantId);
  const { error } = await query;

  if (error) {
    console.error("Error deleting JPP weekly growth:", error);
    throw new Error("Failed to delete weekly growth entry");
  }

  return true;
}

export async function uploadBirdPhoto(file, options = {}) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  if (!file) {
    return null;
  }

  if (!file.type || !file.type.startsWith("image/")) {
    throw new Error("Please upload an image file.");
  }

  const extension = file.name?.split(".").pop() || "jpg";
  const safeExtension = extension.toLowerCase().replace(/[^a-z0-9]/g, "");
  const suffix = Math.random().toString(36).slice(2, 10);
  const fileName = `${Date.now()}-${suffix}.${safeExtension || "jpg"}`;
  const folder = options.folder || "jpp";
  const filePath = `${folder}/${fileName}`;

  const { error: uploadError } = await supabase.storage.from("birds").upload(filePath, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type,
  });

  if (uploadError) {
    console.error("Error uploading bird photo:", uploadError);
    throw uploadError;
  }

  const { data: publicData } = supabase.storage.from("birds").getPublicUrl(filePath);

  return {
    path: filePath,
    publicUrl: publicData?.publicUrl || null,
  };
}

const MEMBER_AVATAR_MAX_SIZE_BYTES = 10 * 1024 * 1024;

export async function uploadMemberAvatar(file, options = {}) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }
  if (!file) {
    throw new Error("Avatar file is required.");
  }
  const mimeType = String(file?.type || "")
    .trim()
    .toLowerCase();
  if (!mimeType.startsWith("image/")) {
    throw new Error("Only image files are allowed for member avatar.");
  }
  const fileSize = Number(file?.size || 0);
  if (!Number.isFinite(fileSize) || fileSize <= 0) {
    throw new Error("Invalid avatar file size.");
  }
  if (fileSize > MEMBER_AVATAR_MAX_SIZE_BYTES) {
    throw new Error("Avatar file is too large. Maximum allowed size is 10 MB.");
  }

  const tenantId = normalizeOptional(options?.tenantId ?? options?.tenant_id);
  if (!tenantId) {
    throw new Error("Tenant is required for avatar upload.");
  }

  const tenantSegment = sanitizeStorageSegment(tenantId, "global");
  const memberSegment = sanitizeStorageSegment(
    options?.memberId ?? options?.member_id ?? "pending",
    "pending"
  );
  const extension =
    String(file?.name || "")
      .split(".")
      .pop()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "") || "jpg";
  const safeExtension = extension || "jpg";
  const baseName = sanitizeDocumentName(file?.name, "member-avatar");
  const suffix = Math.random().toString(36).slice(2, 10);
  const timestamp = Date.now();
  const fileName = `${timestamp}-${baseName}-${suffix}.${safeExtension}`;
  const filePath = `tenants/${tenantSegment}/members/${memberSegment}/avatars/${fileName}`;

  const { error: uploadError } = await supabase.storage.from("birds").upload(filePath, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || undefined,
  });

  if (uploadError) {
    console.error("Error uploading member avatar:", uploadError);
    throw uploadError;
  }

  const { data: publicData } = supabase.storage.from("birds").getPublicUrl(filePath);
  return {
    path: filePath,
    publicUrl: publicData?.publicUrl || null,
    mimeType: mimeType || file.type || null,
    fileSizeBytes: fileSize,
  };
}

function sanitizeStorageSegment(value, fallback = "global") {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return normalized || fallback;
}

function deriveCaptionFromFileName(fileName) {
  const base = String(fileName || "")
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .trim();
  return normalizeOptional(base);
}

const PROJECT_DOCUMENT_BUCKET = "project-docs";
const ORGANIZATION_TEMPLATE_BUCKET = "organization-templates";
const PROJECT_DOCUMENT_MAX_SIZE_BYTES = 25 * 1024 * 1024;
const PROJECT_DOCUMENT_ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const PROJECT_DOCUMENT_ALLOWED_EXTENSIONS = new Set([
  "pdf",
  "docx",
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "bmp",
  "heic",
  "heif",
  "tif",
  "tiff",
]);

const PROJECT_EXPENSE_RECEIPT_MAX_SIZE_BYTES = 15 * 1024 * 1024;
const PROJECT_EXPENSE_RECEIPT_ALLOWED_MIME_TYPES = new Set(["application/pdf"]);
const PROJECT_EXPENSE_RECEIPT_ALLOWED_EXTENSIONS = new Set([
  "pdf",
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "bmp",
  "heic",
  "heif",
  "tif",
  "tiff",
]);

const ACTIVITY_POSTER_MAX_SIZE_BYTES = 8 * 1024 * 1024;
const ACTIVITY_POSTER_ALLOWED_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "bmp",
  "heic",
  "heif",
  "tif",
  "tiff",
]);

const getFileExtension = (fileName) =>
  String(fileName || "")
    .split(".")
    .pop()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const getTemplateFormatFromMetadata = (row = {}) => {
  const fileExt =
    normalizeOptional(row?.file_ext) ||
    getFileExtension(normalizeOptional(row?.file_path) || normalizeOptional(row?.file_url) || "");
  const mimeType = String(normalizeOptional(row?.mime_type) || "")
    .trim()
    .toLowerCase();
  const explicitFormat = String(normalizeOptional(row?.format) || "")
    .trim()
    .toUpperCase();

  const extension = String(fileExt || "")
    .trim()
    .toLowerCase();

  if (extension === "docx") return "DOCX";
  if (extension === "pdf") return "PDF";
  if (extension === "xlsx" || extension === "xls") return "XLSX";
  if (extension === "pptx" || extension === "ppt") return "PPTX";
  if (extension === "csv") return "CSV";
  if (extension === "jpg" || extension === "jpeg") return "JPG";
  if (extension === "png") return "PNG";
  if (extension === "svg") return "SVG";
  if (extension === "webp") return "WEBP";
  if (extension === "gif") return "GIF";

  if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return "DOCX";
  if (mimeType === "application/pdf") return "PDF";
  if (mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") return "XLSX";
  if (mimeType === "application/vnd.ms-excel") return "XLSX";
  if (mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation")
    return "PPTX";
  if (mimeType === "text/csv") return "CSV";
  if (mimeType.startsWith("image/")) {
    const imageSubtype = mimeType.split("/")[1] || "";
    return imageSubtype ? imageSubtype.toUpperCase() : "IMAGE";
  }

  if (explicitFormat) {
    return explicitFormat;
  }

  return extension ? extension.toUpperCase() : "FILE";
};

const isAllowedProjectDocumentType = (file) => {
  const mimeType = String(file?.type || "")
    .trim()
    .toLowerCase();
  const extension = getFileExtension(file?.name);
  const allowedByMime = mimeType.startsWith("image/") || PROJECT_DOCUMENT_ALLOWED_MIME_TYPES.has(mimeType);
  const allowedByExtension = PROJECT_DOCUMENT_ALLOWED_EXTENSIONS.has(extension);
  return {
    isAllowed: allowedByMime || allowedByExtension,
    mimeType,
    extension,
  };
};

const isAllowedExpenseReceiptType = (file) => {
  const mimeType = String(file?.type || "")
    .trim()
    .toLowerCase();
  const extension = getFileExtension(file?.name);
  const allowedByMime =
    mimeType.startsWith("image/") || PROJECT_EXPENSE_RECEIPT_ALLOWED_MIME_TYPES.has(mimeType);
  const allowedByExtension = PROJECT_EXPENSE_RECEIPT_ALLOWED_EXTENSIONS.has(extension);
  return {
    isAllowed: allowedByMime || allowedByExtension,
    mimeType,
    extension,
  };
};

const isAllowedActivityPosterType = (file) => {
  const mimeType = String(file?.type || "")
    .trim()
    .toLowerCase();
  const extension = getFileExtension(file?.name);
  const allowedByMime = mimeType.startsWith("image/");
  const allowedByExtension = ACTIVITY_POSTER_ALLOWED_EXTENSIONS.has(extension);
  return {
    isAllowed: allowedByMime || allowedByExtension,
    mimeType,
    extension,
  };
};

const sanitizeDocumentName = (fileName, fallback = "document") =>
  String(fileName || "")
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || fallback;

const extractStorageMessage = (error) => {
  const message = String(error?.message || error?.details || "").trim();
  if (!message) return "";
  return message.toLowerCase();
};

export async function uploadOrganizationActivityPoster(file, tenantId, options = {}) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  if (!file) {
    throw new Error("Activity poster file is required.");
  }

  const { isAllowed, mimeType, extension } = isAllowedActivityPosterType(file);
  if (!isAllowed) {
    throw new Error("Upload poster as an image file (.jpg, .png, .webp, .gif).");
  }

  const fileSize = Number(file?.size || 0);
  if (!Number.isFinite(fileSize) || fileSize <= 0) {
    throw new Error("Invalid poster file size.");
  }
  if (fileSize > ACTIVITY_POSTER_MAX_SIZE_BYTES) {
    throw new Error("Poster file is too large. Maximum allowed size is 8 MB.");
  }

  const safeExtension = extension || (mimeType.startsWith("image/") ? "jpg" : "bin");
  const tenantSegment = sanitizeStorageSegment(tenantId, "global");
  const safeBaseName = sanitizeDocumentName(file?.name, "activity-poster");
  const suffix = Math.random().toString(36).slice(2, 10);
  const timestamp = Date.now();
  const fileName = `${timestamp}-${safeBaseName}-${suffix}.${safeExtension}`;
  const filePath = `tenants/${tenantSegment}/activities/posters/${fileName}`;

  const { error: uploadError } = await supabase.storage.from(PROJECT_DOCUMENT_BUCKET).upload(filePath, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || undefined,
  });

  if (uploadError) {
    console.error("Error uploading activity poster:", uploadError);
    throw uploadError;
  }

  const previousPath = String(options?.existingPath || options?.existing_path || "").trim();
  if (previousPath) {
    const { error: removeError } = await supabase.storage.from(PROJECT_DOCUMENT_BUCKET).remove([previousPath]);
    if (removeError) {
      const message = extractStorageMessage(removeError);
      if (!message.includes("not found")) {
        console.warn("Previous activity poster cleanup failed:", removeError);
      }
    }
  }

  const { data: publicData } = supabase.storage.from(PROJECT_DOCUMENT_BUCKET).getPublicUrl(filePath);
  return {
    poster_path: filePath,
    poster_url: publicData?.publicUrl || null,
    mime_type: mimeType || file.type || "application/octet-stream",
    file_size_bytes: fileSize,
  };
}

export async function getProjectDocuments(projectRef, tenantId) {
  if (!isSupabaseConfigured || !supabase) {
    return [];
  }

  const projectId = await resolveProjectId(projectRef, tenantId);

  let query = supabase
    .from("project_documents")
    .select(
      "id, project_id, tenant_id, name, file_path, file_url, mime_type, file_ext, file_size_bytes, uploaded_by_member_id, uploaded_at, updated_at, archived_at"
    )
    .eq("project_id", projectId)
    .is("archived_at", null)
    .order("uploaded_at", { ascending: false });
  query = applyTenantFilter(query, tenantId);
  const { data, error } = await query;

  if (error && isMissingRelationError(error, "project_documents")) {
    throw new Error("Project documents table is not available. Run migration_045_project_documents.sql.");
  }
  if (error) {
    console.error("Error fetching project documents:", error);
    throw error;
  }

  const rows = Array.isArray(data) ? data : [];
  const memberIds = Array.from(
    new Set(
      rows
        .map((row) => Number.parseInt(String(row?.uploaded_by_member_id ?? ""), 10))
        .filter((id) => Number.isInteger(id) && id > 0)
    )
  );

  const memberNames = new Map();
  if (memberIds.length) {
    const { data: members, error: memberError } = await supabase
      .from("members")
      .select("id, name")
      .in("id", memberIds);
    if (memberError) {
      console.warn("Error loading document uploader names:", memberError);
    } else {
      (members || []).forEach((member) => {
        memberNames.set(member.id, member.name || `Member #${member.id}`);
      });
    }
  }

  const signedUrlMap = new Map();
  await Promise.all(
    rows
      .map((row) => String(row?.file_path || "").trim())
      .filter(Boolean)
      .map(async (path) => {
        const { data: signedData, error: signedError } = await supabase.storage
          .from(PROJECT_DOCUMENT_BUCKET)
          .createSignedUrl(path, 60 * 60);
        if (signedError) {
          console.warn("Error creating signed document URL:", signedError);
          return;
        }
        signedUrlMap.set(path, signedData?.signedUrl || null);
      })
  );

  return rows.map((row) => ({
    ...row,
    uploader_name: row?.uploaded_by_member_id
      ? memberNames.get(row.uploaded_by_member_id) || null
      : null,
    download_url: signedUrlMap.get(String(row?.file_path || "").trim()) || row?.file_url || null,
  }));
}

export async function uploadProjectDocument(projectRef, file, options = {}, tenantId) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  if (!file) {
    throw new Error("Document file is required.");
  }

  const projectId = await resolveProjectId(projectRef, tenantId);
  let effectiveTenantId = normalizeOptional(tenantId);
  try {
    const { data: projectRow, error: projectError } = await supabase
      .from("iga_projects")
      .select("tenant_id")
      .eq("id", projectId)
      .maybeSingle();
    if (projectError) {
      console.warn("Unable to resolve tenant from project before document upload:", projectError);
    } else {
      const projectTenantId = normalizeOptional(projectRow?.tenant_id);
      if (projectTenantId) {
        effectiveTenantId = projectTenantId;
      }
    }
  } catch (projectTenantLookupError) {
    console.warn("Project tenant lookup failed before document upload:", projectTenantLookupError);
  }

  if (!effectiveTenantId) {
    throw new Error("Project tenant is missing. Assign this project to a tenant, then try again.");
  }

  const { isAllowed, mimeType, extension } = isAllowedProjectDocumentType(file);
  if (!isAllowed) {
    throw new Error("Only .docx, .pdf, and image files are allowed.");
  }

  const fileSize = Number(file?.size || 0);
  if (!Number.isFinite(fileSize) || fileSize <= 0) {
    throw new Error("Invalid file size.");
  }
  if (fileSize > PROJECT_DOCUMENT_MAX_SIZE_BYTES) {
    throw new Error("File is too large. Maximum allowed size is 25 MB.");
  }

  const safeExtension = extension || (mimeType.startsWith("image/") ? "jpg" : "bin");
  const tenantSegment = sanitizeStorageSegment(effectiveTenantId, "global");
  const safeBaseName = sanitizeDocumentName(file?.name);
  const suffix = Math.random().toString(36).slice(2, 10);
  const timestamp = Date.now();
  const fileName = `${timestamp}-${safeBaseName}-${suffix}.${safeExtension}`;
  const filePath = `tenants/${tenantSegment}/projects/${projectId}/documents/${fileName}`;

  const { error: uploadError } = await supabase.storage.from(PROJECT_DOCUMENT_BUCKET).upload(filePath, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || undefined,
  });

  if (uploadError) {
    console.error("Error uploading project document:", uploadError);
    throw uploadError;
  }

  const { data: publicData } = supabase.storage.from(PROJECT_DOCUMENT_BUCKET).getPublicUrl(filePath);
  const uploadedByMemberId = parseOptionalMemberId(options?.uploaded_by_member_id ?? options?.uploadedByMemberId);

  const insertPayload = {
    project_id: projectId,
    tenant_id: effectiveTenantId,
    name: normalizeOptional(options?.name) || file.name || "Document",
    file_path: filePath,
    file_url: publicData?.publicUrl || null,
    mime_type: mimeType || file.type || "application/octet-stream",
    file_ext: safeExtension,
    file_size_bytes: fileSize,
    uploaded_by_member_id: uploadedByMemberId,
  };

  const { data, error } = await supabase
    .from("project_documents")
    .insert(insertPayload)
    .select(
      "id, project_id, tenant_id, name, file_path, file_url, mime_type, file_ext, file_size_bytes, uploaded_by_member_id, uploaded_at, updated_at, archived_at"
    )
    .single();

  if (error && isMissingRelationError(error, "project_documents")) {
    try {
      await supabase.storage.from(PROJECT_DOCUMENT_BUCKET).remove([filePath]);
    } catch (cleanupError) {
      console.warn("Failed to cleanup uploaded document after missing table error:", cleanupError);
    }
    throw new Error("Project documents table is not available. Run migration_045_project_documents.sql.");
  }
  if (error) {
    try {
      await supabase.storage.from(PROJECT_DOCUMENT_BUCKET).remove([filePath]);
    } catch (cleanupError) {
      console.warn("Failed to cleanup uploaded document after insert error:", cleanupError);
    }
    console.error("Error creating project document record:", error);
    throw error;
  }

  const { data: signedData, error: signedError } = await supabase.storage
    .from(PROJECT_DOCUMENT_BUCKET)
    .createSignedUrl(filePath, 60 * 60);
  if (signedError) {
    console.warn("Error creating signed URL for uploaded project document:", signedError);
  }

  return {
    ...data,
    download_url: signedData?.signedUrl || null,
  };
}

export async function renameProjectDocument(documentId, name, tenantId) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  const parsedDocumentId = String(documentId || "").trim();
  if (!parsedDocumentId) {
    throw new Error("Document id is required.");
  }

  const nextName = String(name || "").trim();
  if (!nextName) {
    throw new Error("Document name is required.");
  }

  let updateQuery = supabase
    .from("project_documents")
    .update({ name: nextName })
    .eq("id", parsedDocumentId)
    .select(
      "id, project_id, tenant_id, name, file_path, file_url, mime_type, file_ext, file_size_bytes, uploaded_by_member_id, uploaded_at, updated_at, archived_at"
    )
    .single();
  updateQuery = applyTenantFilter(updateQuery, tenantId);
  const { data, error } = await updateQuery;

  if (error && isMissingRelationError(error, "project_documents")) {
    throw new Error("Project documents table is not available. Run migration_045_project_documents.sql.");
  }
  if (error) {
    console.error("Error renaming project document:", error);
    throw error;
  }

  const path = String(data?.file_path || "").trim();
  let downloadUrl = null;
  if (path) {
    const { data: signedData, error: signedError } = await supabase.storage
      .from(PROJECT_DOCUMENT_BUCKET)
      .createSignedUrl(path, 60 * 60);
    if (signedError) {
      console.warn("Error creating signed URL for renamed project document:", signedError);
    } else {
      downloadUrl = signedData?.signedUrl || null;
    }
  }

  return {
    ...data,
    download_url: downloadUrl || null,
  };
}

export async function deleteProjectDocument(documentId, tenantId) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  const parsedDocumentId = String(documentId || "").trim();
  if (!parsedDocumentId) {
    throw new Error("Document id is required.");
  }

  let existingQuery = supabase
    .from("project_documents")
    .select("id, file_path")
    .eq("id", parsedDocumentId)
    .maybeSingle();
  existingQuery = applyTenantFilter(existingQuery, tenantId);
  const { data: existingDoc, error: existingError } = await existingQuery;

  if (existingError && isMissingRelationError(existingError, "project_documents")) {
    throw new Error("Project documents table is not available. Run migration_045_project_documents.sql.");
  }
  if (existingError) {
    console.error("Error loading project document before delete:", existingError);
    throw existingError;
  }
  if (!existingDoc) {
    return true;
  }

  const path = String(existingDoc?.file_path || "").trim();
  if (path) {
    const { error: storageError } = await supabase.storage.from(PROJECT_DOCUMENT_BUCKET).remove([path]);
    if (storageError) {
      const message = extractStorageMessage(storageError);
      if (!message.includes("not found")) {
        console.error("Error deleting project document file from storage:", storageError);
        throw storageError;
      }
    }
  }

  let deleteQuery = supabase
    .from("project_documents")
    .delete()
    .eq("id", parsedDocumentId);
  deleteQuery = applyTenantFilter(deleteQuery, tenantId);
  const { error: deleteError } = await deleteQuery;

  if (deleteError) {
    console.error("Error deleting project document record:", deleteError);
    throw deleteError;
  }

  return true;
}

export async function createProjectMediaAssets(projectId, files = [], tenantId) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  const parsedProjectId = Number.parseInt(String(projectId), 10);
  if (!Number.isInteger(parsedProjectId) || parsedProjectId <= 0) {
    throw new Error("Invalid project id");
  }

  if (!Array.isArray(files) || files.length === 0) {
    return { gallery: [], coverUrl: null };
  }

  const tenantSegment = sanitizeStorageSegment(tenantId, "global");
  const folder = `tenants/${tenantSegment}/projects/${parsedProjectId}/media`;

  let nextDisplayOrder = 0;
  let orderQuery = supabase
    .from("project_gallery")
    .select("display_order")
    .eq("project_id", parsedProjectId)
    .order("display_order", { ascending: false })
    .limit(1);
  orderQuery = applyTenantFilter(orderQuery, tenantId);
  const { data: existingRows } = await orderQuery;
  if (existingRows?.length) {
    nextDisplayOrder = Number(existingRows[0]?.display_order ?? -1) + 1;
    if (!Number.isFinite(nextDisplayOrder) || nextDisplayOrder < 0) {
      nextDisplayOrder = 0;
    }
  }

  const uploadedFiles = [];
  for (const file of files) {
    if (!file) continue;
    const uploaded = await uploadBirdPhoto(file, { folder });
    uploadedFiles.push({
      ...uploaded,
      originalName: file.name || null,
    });
  }

  if (!uploadedFiles.length) {
    return { gallery: [], coverUrl: null };
  }

  const galleryPayload = uploadedFiles.map((file, index) => ({
    project_id: parsedProjectId,
    image_url: file.publicUrl || file.path,
    caption: deriveCaptionFromFileName(file.originalName),
    is_primary: index === 0 && nextDisplayOrder === 0,
    display_order: nextDisplayOrder + index,
    tenant_id: tenantId ?? null,
  }));

  const { data: galleryRows, error: galleryError } = await supabase
    .from("project_gallery")
    .insert(galleryPayload)
    .select("id, image_url, caption, is_primary, display_order");

  if (galleryError) {
    const paths = uploadedFiles.map((file) => file.path).filter(Boolean);
    if (paths.length) {
      try {
        await supabase.storage.from("birds").remove(paths);
      } catch (cleanupError) {
        console.warn("Failed to cleanup uploaded media after gallery insert error:", cleanupError);
      }
    }
    console.error("Error creating project gallery records:", galleryError);
    throw new Error("Failed to save project media entries");
  }

  const coverUrl = galleryPayload[0]?.image_url || null;
  if (coverUrl) {
    let updateQuery = supabase
      .from("iga_projects")
      .update({ image_url: coverUrl })
      .eq("id", parsedProjectId);
    updateQuery = applyTenantFilter(updateQuery, tenantId);
    const { error: coverError } = await updateQuery;
    if (coverError) {
      console.error("Error updating project cover image:", coverError);
      throw new Error("Media uploaded, but failed to update project cover image");
    }
  }

  return {
    gallery: galleryRows || [],
    coverUrl,
  };
}

export async function createJppBird(payload, tenantId, projectId) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  const user = await getCurrentMember();

  const insertPayload = {
    product_id: payload.product_id,
    batch_id: normalizeOptional(payload.batch_id),
    project_id: payload?.project_id ?? projectId ?? null,
    tag_id: normalizeOptional(payload.tag_id),
    bird_name: normalizeOptional(payload.bird_name),
    sex: payload.sex || "unknown",
    breed_label: normalizeOptional(payload.breed_label) || "unknown",
    hatch_date: normalizeOptional(payload.hatch_date),
    acquired_date: payload.acquired_date,
    acquired_source: payload.acquired_source || "bought",
    status: payload.status || "alive",
    status_date: payload.status_date || payload.acquired_date,
    photo_url: normalizeOptional(payload.photo_url),
    notes: normalizeOptional(payload.notes),
    description: normalizeOptional(payload.description),
    color_label: normalizeOptional(payload.color_label),
    pattern_label: normalizeOptional(payload.pattern_label),
    age_stage: payload.age_stage || "unknown",
    created_by: user?.auth_id || null,
    tenant_id: tenantId ?? null,
  };

  const { data, error } = await supabase
    .from("jpp_birds")
    .insert(insertPayload)
    .select()
    .single();

  if (error) {
    console.error("Error creating JPP bird:", error);
    throw new Error("Failed to create bird");
  }

  return data;
}

export async function createProjectExpense(projectRef, payload, tenantId) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  const projectId = await resolveProjectId(projectRef, tenantId);
  const paymentReference = normalizeOptional(payload.payment_reference ?? payload.paymentReference);
  const explicitReceiptFlag =
    "receipt" in payload ? Boolean(payload.receipt) : Boolean(payload.receipt_available);
  const receipt =
    explicitReceiptFlag ||
    Boolean(paymentReference) ||
    Boolean(normalizeOptional(payload.receipt_file_path ?? payload.receiptFilePath)) ||
    Boolean(normalizeOptional(payload.receipt_file_url ?? payload.receiptFileUrl));

  const insertPayload = {
    project_id: projectId,
    batch_id: normalizeOptional(payload.batch_id),
    expense_date: payload.expense_date,
    category: payload.category,
    amount: payload.amount,
    vendor: normalizeOptional(payload.vendor),
    description: normalizeOptional(payload.description),
    receipt,
    approved_by: payload.approved_by ?? null,
    created_by: payload.created_by ?? null,
    tenant_id: tenantId ?? null,
  };
  if (paymentReference !== null) {
    insertPayload.payment_reference = paymentReference;
  }
  const receiptPath = normalizeOptional(payload.receipt_file_path ?? payload.receiptFilePath);
  if (receiptPath !== null) {
    insertPayload.receipt_file_path = receiptPath;
  }
  const receiptUrl = normalizeOptional(payload.receipt_file_url ?? payload.receiptFileUrl);
  if (receiptUrl !== null) {
    insertPayload.receipt_file_url = receiptUrl;
  }
  const receiptMimeType = normalizeOptional(payload.receipt_mime_type ?? payload.receiptMimeType);
  if (receiptMimeType !== null) {
    insertPayload.receipt_mime_type = receiptMimeType;
  }
  const receiptFileSize = Number(payload.receipt_file_size_bytes ?? payload.receiptFileSizeBytes);
  if (Number.isFinite(receiptFileSize) && receiptFileSize >= 0) {
    insertPayload.receipt_file_size_bytes = receiptFileSize;
  }
  const receiptUploadedAt = normalizeOptional(payload.receipt_uploaded_at ?? payload.receiptUploadedAt);
  if (receiptUploadedAt !== null) {
    insertPayload.receipt_uploaded_at = receiptUploadedAt;
  }

  const { data, error } = await supabase
    .from("project_expenses")
    .insert(insertPayload)
    .select();

  if (
    error &&
    (isMissingColumnError(error, "payment_reference") ||
      isMissingColumnError(error, "receipt_file_path") ||
      isMissingColumnError(error, "receipt_file_url") ||
      isMissingColumnError(error, "receipt_mime_type") ||
      isMissingColumnError(error, "receipt_file_size_bytes") ||
      isMissingColumnError(error, "receipt_uploaded_at"))
  ) {
    throw new Error("Project expense receipt columns are missing. Run migration_046_project_expense_receipts.sql.");
  }
  if (error) {
    console.error("Error creating project expense:", error);
    throw error;
  }

  await ensureProjectExpenseCategoryDefinition(projectId, payload?.category, tenantId);

  return data?.[0] || null;
}

export async function updateProjectExpense(expenseId, payload, tenantId) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  const updatePayload = {};

  if ("batch_id" in payload) updatePayload.batch_id = normalizeOptional(payload.batch_id);
  if ("expense_date" in payload) updatePayload.expense_date = payload.expense_date;
  if ("category" in payload) updatePayload.category = payload.category;
  if ("amount" in payload) updatePayload.amount = payload.amount;
  if ("vendor" in payload) updatePayload.vendor = normalizeOptional(payload.vendor);
  if ("description" in payload) updatePayload.description = normalizeOptional(payload.description);
  if ("receipt" in payload) updatePayload.receipt = Boolean(payload.receipt);
  if ("receipt_available" in payload) {
    updatePayload.receipt = Boolean(payload.receipt_available);
  }
  if ("payment_reference" in payload || "paymentReference" in payload) {
    updatePayload.payment_reference = normalizeOptional(
      payload.payment_reference ?? payload.paymentReference
    );
  }
  if ("receipt_file_path" in payload || "receiptFilePath" in payload) {
    updatePayload.receipt_file_path = normalizeOptional(
      payload.receipt_file_path ?? payload.receiptFilePath
    );
  }
  if ("receipt_file_url" in payload || "receiptFileUrl" in payload) {
    updatePayload.receipt_file_url = normalizeOptional(
      payload.receipt_file_url ?? payload.receiptFileUrl
    );
  }
  if ("receipt_mime_type" in payload || "receiptMimeType" in payload) {
    updatePayload.receipt_mime_type = normalizeOptional(
      payload.receipt_mime_type ?? payload.receiptMimeType
    );
  }
  if ("receipt_file_size_bytes" in payload || "receiptFileSizeBytes" in payload) {
    const receiptFileSize = Number(payload.receipt_file_size_bytes ?? payload.receiptFileSizeBytes);
    updatePayload.receipt_file_size_bytes =
      Number.isFinite(receiptFileSize) && receiptFileSize >= 0 ? receiptFileSize : null;
  }
  if ("receipt_uploaded_at" in payload || "receiptUploadedAt" in payload) {
    updatePayload.receipt_uploaded_at = normalizeOptional(
      payload.receipt_uploaded_at ?? payload.receiptUploadedAt
    );
  }
  if ("approved_by" in payload) updatePayload.approved_by = payload.approved_by;
  if ("created_by" in payload) updatePayload.created_by = payload.created_by;

  if (
    !("receipt" in payload) &&
    !("receipt_available" in payload) &&
    (("payment_reference" in payload || "paymentReference" in payload) ||
      ("receipt_file_path" in payload || "receiptFilePath" in payload) ||
      ("receipt_file_url" in payload || "receiptFileUrl" in payload))
  ) {
    const hasProof =
      Boolean(normalizeOptional(payload.payment_reference ?? payload.paymentReference)) ||
      Boolean(normalizeOptional(payload.receipt_file_path ?? payload.receiptFilePath)) ||
      Boolean(normalizeOptional(payload.receipt_file_url ?? payload.receiptFileUrl));
    if (hasProof) {
      updatePayload.receipt = true;
    }
  }

  if (Object.keys(updatePayload).length === 0) {
    throw new Error("No fields to update");
  }

  updatePayload.updated_at = new Date().toISOString();

  let query = supabase
    .from("project_expenses")
    .update(updatePayload)
    .eq("id", expenseId);
  query = applyTenantFilter(query, tenantId);
  const { data, error } = await query.select();

  if (
    error &&
    (isMissingColumnError(error, "payment_reference") ||
      isMissingColumnError(error, "receipt_file_path") ||
      isMissingColumnError(error, "receipt_file_url") ||
      isMissingColumnError(error, "receipt_mime_type") ||
      isMissingColumnError(error, "receipt_file_size_bytes") ||
      isMissingColumnError(error, "receipt_uploaded_at"))
  ) {
    throw new Error("Project expense receipt columns are missing. Run migration_046_project_expense_receipts.sql.");
  }
  if (error) {
    console.error("Error updating project expense:", error);
    throw error;
  }

  const updatedRow = data?.[0] || null;
  const categoryToSync = "category" in payload ? payload.category : updatedRow?.category;
  if (updatedRow?.project_id && categoryToSync) {
    await ensureProjectExpenseCategoryDefinition(updatedRow.project_id, categoryToSync, tenantId);
  }

  return updatedRow;
}

export async function uploadProjectExpenseReceipt(expenseId, file, tenantId) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  const parsedExpenseId = String(expenseId || "").trim();
  if (!parsedExpenseId) {
    throw new Error("Expense id is required.");
  }
  if (!file) {
    throw new Error("Receipt file is required.");
  }

  const { isAllowed, mimeType, extension } = isAllowedExpenseReceiptType(file);
  if (!isAllowed) {
    throw new Error("Upload a receipt proof as .pdf or image.");
  }

  const fileSize = Number(file?.size || 0);
  if (!Number.isFinite(fileSize) || fileSize <= 0) {
    throw new Error("Invalid receipt file size.");
  }
  if (fileSize > PROJECT_EXPENSE_RECEIPT_MAX_SIZE_BYTES) {
    throw new Error("Receipt file is too large. Maximum allowed size is 15 MB.");
  }

  let expenseQuery = supabase
    .from("project_expenses")
    .select("id, project_id, tenant_id, receipt_file_path")
    .eq("id", parsedExpenseId)
    .maybeSingle();
  expenseQuery = applyTenantFilter(expenseQuery, tenantId);
  const { data: expenseRow, error: expenseError } = await expenseQuery;

  if (expenseError && isMissingColumnError(expenseError, "receipt_file_path")) {
    throw new Error("Project expense receipt columns are missing. Run migration_046_project_expense_receipts.sql.");
  }
  if (expenseError) {
    console.error("Error fetching expense for receipt upload:", expenseError);
    throw expenseError;
  }
  if (!expenseRow) {
    throw new Error("Expense not found.");
  }

  const projectId = Number.parseInt(String(expenseRow?.project_id ?? ""), 10);
  if (!Number.isInteger(projectId) || projectId <= 0) {
    throw new Error("Expense is missing a valid project.");
  }

  let effectiveTenantId = normalizeOptional(expenseRow?.tenant_id) || normalizeOptional(tenantId);
  if (!effectiveTenantId) {
    try {
      const { data: projectRow, error: projectError } = await supabase
        .from("iga_projects")
        .select("tenant_id")
        .eq("id", projectId)
        .maybeSingle();
      if (projectError) {
        console.warn("Unable to resolve tenant for expense receipt upload:", projectError);
      } else {
        effectiveTenantId = normalizeOptional(projectRow?.tenant_id) || effectiveTenantId;
      }
    } catch (lookupError) {
      console.warn("Project tenant lookup failed for expense receipt upload:", lookupError);
    }
  }

  if (!effectiveTenantId) {
    throw new Error("Project tenant is missing. Assign this project to a tenant, then try again.");
  }

  const safeExtension = extension || (mimeType.startsWith("image/") ? "jpg" : "pdf");
  const tenantSegment = sanitizeStorageSegment(effectiveTenantId, "global");
  const safeBaseName = sanitizeDocumentName(file?.name, "receipt");
  const suffix = Math.random().toString(36).slice(2, 10);
  const timestamp = Date.now();
  const fileName = `${timestamp}-${safeBaseName}-${suffix}.${safeExtension}`;
  const filePath = `tenants/${tenantSegment}/projects/${projectId}/expenses/${parsedExpenseId}/receipts/${fileName}`;

  const { error: uploadError } = await supabase.storage.from(PROJECT_DOCUMENT_BUCKET).upload(filePath, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || undefined,
  });

  if (uploadError) {
    console.error("Error uploading expense receipt:", uploadError);
    throw uploadError;
  }

  const previousPath = String(expenseRow?.receipt_file_path || "").trim();
  if (previousPath) {
    const { error: removeError } = await supabase.storage.from(PROJECT_DOCUMENT_BUCKET).remove([previousPath]);
    if (removeError) {
      const message = extractStorageMessage(removeError);
      if (!message.includes("not found")) {
        console.warn("Previous expense receipt cleanup failed:", removeError);
      }
    }
  }

  const { data: publicData } = supabase.storage.from(PROJECT_DOCUMENT_BUCKET).getPublicUrl(filePath);
  const nowIso = new Date().toISOString();
  const updatePayload = {
    receipt: true,
    receipt_file_path: filePath,
    receipt_file_url: publicData?.publicUrl || null,
    receipt_mime_type: mimeType || file.type || "application/octet-stream",
    receipt_file_size_bytes: fileSize,
    receipt_uploaded_at: nowIso,
    updated_at: nowIso,
  };

  let updateQuery = supabase
    .from("project_expenses")
    .update(updatePayload)
    .eq("id", parsedExpenseId);
  updateQuery = applyTenantFilter(updateQuery, effectiveTenantId);
  const { data: updatedRows, error: updateError } = await updateQuery.select();

  if (
    updateError &&
    (isMissingColumnError(updateError, "receipt_file_path") ||
      isMissingColumnError(updateError, "receipt_file_url") ||
      isMissingColumnError(updateError, "receipt_mime_type") ||
      isMissingColumnError(updateError, "receipt_file_size_bytes") ||
      isMissingColumnError(updateError, "receipt_uploaded_at"))
  ) {
    throw new Error("Project expense receipt columns are missing. Run migration_046_project_expense_receipts.sql.");
  }
  if (updateError) {
    console.error("Error saving expense receipt metadata:", updateError);
    throw updateError;
  }

  const updatedExpense = updatedRows?.[0] || null;
  const { data: signedData, error: signedError } = await supabase.storage
    .from(PROJECT_DOCUMENT_BUCKET)
    .createSignedUrl(filePath, 60 * 60);
  if (signedError) {
    console.warn("Error creating signed URL for expense receipt:", signedError);
  }

  return {
    ...updatedExpense,
    receipt_download_url: signedData?.signedUrl || null,
  };
}

export async function deleteProjectExpense(expenseId, tenantId) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  let query = supabase
    .from("project_expenses")
    .delete()
    .eq("id", expenseId);
  query = applyTenantFilter(query, tenantId);
  const { error } = await query;

  if (error) {
    console.error("Error deleting project expense:", error);
    throw error;
  }

  return true;
}

export async function createProjectSale(projectRef, payload, tenantId) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  const projectId = await resolveProjectId(projectRef, tenantId);

  const insertPayload = {
    project_id: projectId,
    batch_id: normalizeOptional(payload.batch_id),
    sale_date: payload.sale_date,
    product_type: normalizeOptional(payload.product_type),
    quantity_units: payload.quantity_units ?? 0,
    quantity_kg: payload.quantity_kg ?? 0,
    unit_price: payload.unit_price ?? 0,
    total_amount: payload.total_amount ?? 0,
    customer_name: normalizeOptional(payload.customer_name),
    customer_contact: normalizeOptional(payload.customer_contact),
    customer_type: normalizeOptional(payload.customer_type),
    payment_status: payload.payment_status ?? "paid",
    payment_method: normalizeOptional(payload.payment_method),
    notes: normalizeOptional(payload.notes),
    created_by: payload.created_by ?? null,
    tenant_id: tenantId ?? null,
  };

  const { data, error } = await supabase
    .from("project_sales")
    .insert(insertPayload)
    .select();

  if (error) {
    console.error("Error creating project sale:", error);
    throw error;
  }

  return data?.[0] || null;
}

export async function updateProjectSale(saleId, payload, tenantId) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  const updatePayload = {};

  if ("batch_id" in payload) updatePayload.batch_id = normalizeOptional(payload.batch_id);
  if ("sale_date" in payload) updatePayload.sale_date = payload.sale_date;
  if ("product_type" in payload) updatePayload.product_type = normalizeOptional(payload.product_type);
  if ("quantity_units" in payload) updatePayload.quantity_units = payload.quantity_units;
  if ("quantity_kg" in payload) updatePayload.quantity_kg = payload.quantity_kg;
  if ("unit_price" in payload) updatePayload.unit_price = payload.unit_price;
  if ("total_amount" in payload) updatePayload.total_amount = payload.total_amount;
  if ("customer_name" in payload) updatePayload.customer_name = normalizeOptional(payload.customer_name);
  if ("customer_contact" in payload) updatePayload.customer_contact = normalizeOptional(payload.customer_contact);
  if ("customer_type" in payload) updatePayload.customer_type = normalizeOptional(payload.customer_type);
  if ("payment_status" in payload) updatePayload.payment_status = payload.payment_status;
  if ("payment_method" in payload) updatePayload.payment_method = normalizeOptional(payload.payment_method);
  if ("notes" in payload) updatePayload.notes = normalizeOptional(payload.notes);
  if ("created_by" in payload) updatePayload.created_by = payload.created_by;

  if (Object.keys(updatePayload).length === 0) {
    throw new Error("No fields to update");
  }

  updatePayload.updated_at = new Date().toISOString();

  let query = supabase
    .from("project_sales")
    .update(updatePayload)
    .eq("id", saleId);
  query = applyTenantFilter(query, tenantId);
  const { data, error } = await query.select();

  if (error) {
    console.error("Error updating project sale:", error);
    throw error;
  }

  return data?.[0] || null;
}

export async function deleteProjectSale(saleId, tenantId) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  let query = supabase
    .from("project_sales")
    .delete()
    .eq("id", saleId);
  query = applyTenantFilter(query, tenantId);
  const { error } = await query;

  if (error) {
    console.error("Error deleting project sale:", error);
    throw error;
  }

  return true;
}

export async function createJppExpense(payload, tenantId, projectId) {
  return createProjectExpense(projectId ?? "jpp", payload, tenantId);
}

export async function updateJppExpense(expenseId, payload, tenantId) {
  return updateProjectExpense(expenseId, payload, tenantId);
}

export async function deleteJppExpense(expenseId, tenantId) {
  return deleteProjectExpense(expenseId, tenantId);
}

// ============================================
// JGF (GROUNDNUT FOODS) PROJECT FUNCTIONS
// ============================================

/**
 * Get JGF batches
 */
export async function getJgfBatches(tenantId, projectId) {
  const mockBatches = [
    {
      id: 1,
      batch_code: "JGF-2026-01",
      batch_name: "Peanut Butter Batch 1",
      product_type: "peanut_butter",
      start_date: "2026-01-10",
      status: "completed",
      raw_groundnuts_kg: 50,
      output_quantity_kg: 42,
      output_units: 84,
      unit_size_grams: 500,
      selling_price_per_unit: 350,
    },
    {
      id: 2,
      batch_code: "JGF-2026-02",
      batch_name: "Roasted Nuts Batch 1",
      product_type: "roasted_nuts",
      start_date: "2026-01-15",
      status: "in_progress",
      raw_groundnuts_kg: 30,
      output_quantity_kg: 25,
      output_units: 100,
      unit_size_grams: 250,
      selling_price_per_unit: 200,
    },
  ];

  if (!isSupabaseConfigured || !supabase) return mockBatches;

  let query = supabase
    .from("jgf_batches")
    .select("*")
    .order("start_date", { ascending: false });
  if (projectId) {
    query = query.eq("project_id", projectId);
  }
  query = applyTenantFilter(query, tenantId);
  const { data, error } = await query;

  if (error) {
    console.error("Error fetching JGF batches:", error);
    throw error;
  }

  return data || [];
}

/**
 * Get JGF batch KPIs
 */
export async function getJgfBatchKpis(tenantId, projectId) {
  const mockKpis = [
    {
      id: 1,
      batch_code: "JGF-2026-01",
      batch_name: "Peanut Butter Batch 1",
      product_type: "peanut_butter",
      status: "completed",
      raw_groundnuts_kg: 50,
      output_quantity_kg: 42,
      output_units: 84,
      units_sold: 60,
      units_remaining: 24,
      total_batch_cost: 12500,
      total_revenue: 21000,
      yield_percentage: 84,
    },
  ];

  if (!isSupabaseConfigured || !supabase) return mockKpis;

  let query = supabase
    .from("jgf_batch_kpis")
    .select("*")
    .order("start_date", { ascending: false });
  if (projectId) {
    query = query.eq("project_id", projectId);
  }
  query = applyTenantFilter(query, tenantId);
  const { data, error } = await query;

  if (error) {
    console.error("Error fetching JGF batch KPIs:", error);
    return [];
  }

  return data || [];
}

/**
 * Get JGF inventory
 */
export async function getJgfInventory(tenantId, projectId) {
  const mockInventory = [
    { id: 1, item_type: "raw_material", item_name: "Raw Groundnuts", quantity: 150, unit: "kg", unit_cost: 150, reorder_level: 50 },
    { id: 2, item_type: "packaging", item_name: "Glass Jars 500g", quantity: 200, unit: "units", unit_cost: 45, reorder_level: 100 },
    { id: 3, item_type: "product", item_name: "Peanut Butter 500g", quantity: 24, unit: "units", unit_cost: 0, reorder_level: 0 },
  ];

  if (!isSupabaseConfigured || !supabase) return mockInventory;

  let query = supabase
    .from("jgf_inventory")
    .select("*")
    .order("item_type", { ascending: true });
  if (projectId) {
    query = query.eq("project_id", projectId);
  }
  query = applyTenantFilter(query, tenantId);
  const { data, error } = await query;

  if (error) {
    console.error("Error fetching JGF inventory:", error);
    throw error;
  }

  return data || [];
}

/**
 * Get JGF production logs
 */
export async function getJgfProductionLogs(tenantId, projectId) {
  const mockLogs = [
    {
      id: 1,
      batch_id: 1,
      log_date: "2026-01-10",
      groundnuts_processed_kg: 25,
      output_produced_kg: 21,
      units_packaged: 42,
      quality_grade: "A",
      wastage_kg: 2,
      workers_count: 3,
      hours_worked: 6,
    },
  ];

  if (!isSupabaseConfigured || !supabase) return mockLogs;

  let query = supabase
    .from("jgf_production_logs")
    .select("*")
    .order("log_date", { ascending: false });
  if (projectId) {
    query = query.eq("project_id", projectId);
  }
  query = applyTenantFilter(query, tenantId);
  const { data, error } = await query;

  if (error) {
    console.error("Error fetching JGF production logs:", error);
    throw error;
  }

  return data || [];
}

/**
 * Get JGF sales
 */
export async function getJgfSales(tenantId, projectId) {
  const mockSales = [
    {
      id: 1,
      batch_id: 1,
      sale_date: "2026-01-12",
      product_type: "peanut_butter",
      quantity_units: 20,
      unit_price: 350,
      total_amount: 7000,
      customer_name: "Kosele Market",
      customer_type: "retail",
      payment_status: "paid",
    },
  ];

  if (!isSupabaseConfigured || !supabase) return mockSales;

  return getProjectSales(projectId ?? "jgf", tenantId);
}

/**
 * Get JGF expenses
 */
export async function getJgfExpenses(tenantId, projectId) {
  const mockExpenses = [
    {
      id: 1,
      batch_id: 1,
      expense_date: "2026-01-10",
      category: "Raw Materials",
      amount: 7500,
      vendor: "Local Farmers",
      description: "Raw groundnuts purchase",
      receipt_available: true,
    },
  ];

  if (!isSupabaseConfigured || !supabase) return mockExpenses;

  const expenses = await getProjectExpenses(projectId ?? "jgf", tenantId);
  return expenses.map((expense) => ({
    ...expense,
    receipt_available: Boolean(expense.receipt),
  }));
}

/**
 * Get JGF purchases
 */
export async function getJgfPurchases(tenantId, projectId) {
  const mockPurchases = [
    {
      id: 1,
      purchase_date: "2026-01-08",
      supplier_name: "Kosele Farmers Coop",
      item_type: "groundnuts",
      quantity: 50,
      unit: "kg",
      unit_price: 150,
      total_amount: 7500,
      quality_grade: "A",
      payment_status: "paid",
    },
  ];

  if (!isSupabaseConfigured || !supabase) return mockPurchases;

  let query = supabase
    .from("jgf_purchases")
    .select("*")
    .order("purchase_date", { ascending: false });
  if (projectId) {
    query = query.eq("project_id", projectId);
  }
  query = applyTenantFilter(query, tenantId);
  const { data, error } = await query;

  if (error) {
    console.error("Error fetching JGF purchases:", error);
    throw error;
  }

  return data || [];
}

// JGF CRUD Operations

export async function createJgfBatch(payload, tenantId, projectId) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  const { data, error } = await supabase
    .from("jgf_batches")
    .insert({
      ...payload,
      project_id: payload?.project_id ?? projectId ?? null,
      tenant_id: tenantId ?? null,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating JGF batch:", error);
    throw new Error("Failed to create batch");
  }

  return data;
}

export async function updateJgfBatch(batchId, payload, tenantId) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  let query = supabase
    .from("jgf_batches")
    .update(payload)
    .eq("id", batchId);
  query = applyTenantFilter(query, tenantId);
  const { data, error } = await query.select().single();

  if (error) {
    console.error("Error updating JGF batch:", error);
    throw new Error("Failed to update batch");
  }

  return data;
}

export async function deleteJgfBatch(batchId, tenantId) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  let query = supabase
    .from("jgf_batches")
    .delete()
    .eq("id", batchId);
  query = applyTenantFilter(query, tenantId);
  const { error } = await query;

  if (error) {
    console.error("Error deleting JGF batch:", error);
    throw new Error("Failed to delete batch");
  }

  return true;
}

export async function createJgfProductionLog(payload, tenantId, projectId) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  const { data, error } = await supabase
    .from("jgf_production_logs")
    .insert({
      ...payload,
      project_id: payload?.project_id ?? projectId ?? null,
      tenant_id: tenantId ?? null,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating JGF production log:", error);
    throw new Error("Failed to create production log");
  }

  return data;
}

export async function updateJgfProductionLog(logId, payload, tenantId) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  let query = supabase
    .from("jgf_production_logs")
    .update(payload)
    .eq("id", logId);
  query = applyTenantFilter(query, tenantId);
  const { data, error } = await query.select().single();

  if (error) {
    console.error("Error updating JGF production log:", error);
    throw new Error("Failed to update production log");
  }

  return data;
}

export async function deleteJgfProductionLog(logId, tenantId) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  let query = supabase
    .from("jgf_production_logs")
    .delete()
    .eq("id", logId);
  query = applyTenantFilter(query, tenantId);
  const { error } = await query;

  if (error) {
    console.error("Error deleting JGF production log:", error);
    throw new Error("Failed to delete production log");
  }

  return true;
}

export async function createJgfSale(payload, tenantId, projectId) {
  return createProjectSale(projectId ?? "jgf", payload, tenantId);
}

export async function updateJgfSale(saleId, payload, tenantId) {
  return updateProjectSale(saleId, payload, tenantId);
}

export async function deleteJgfSale(saleId, tenantId) {
  return deleteProjectSale(saleId, tenantId);
}

export async function createJgfExpense(payload, tenantId, projectId) {
  return createProjectExpense(projectId ?? "jgf", payload, tenantId);
}

export async function updateJgfExpense(expenseId, payload, tenantId) {
  return updateProjectExpense(expenseId, payload, tenantId);
}

export async function deleteJgfExpense(expenseId, tenantId) {
  return deleteProjectExpense(expenseId, tenantId);
}

export async function updateJgfInventory(itemId, payload, tenantId) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  let query = supabase
    .from("jgf_inventory")
    .update(payload)
    .eq("id", itemId);
  query = applyTenantFilter(query, tenantId);
  const { data, error } = await query.select().single();

  if (error) {
    console.error("Error updating JGF inventory:", error);
    throw new Error("Failed to update inventory");
  }

  return data;
}

export async function createJgfPurchase(payload, tenantId, projectId) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  const { data, error } = await supabase
    .from("jgf_purchases")
    .insert({
      ...payload,
      project_id: payload?.project_id ?? projectId ?? null,
      tenant_id: tenantId ?? null,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating JGF purchase:", error);
    throw new Error("Failed to create purchase");
  }

  return data;
}

export async function updateJgfPurchase(purchaseId, payload, tenantId) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  let query = supabase
    .from("jgf_purchases")
    .update(payload)
    .eq("id", purchaseId);
  query = applyTenantFilter(query, tenantId);
  const { data, error } = await query.select().single();

  if (error) {
    console.error("Error updating JGF purchase:", error);
    throw new Error("Failed to update purchase");
  }

  return data;
}

export async function deleteJgfPurchase(purchaseId, tenantId) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  let query = supabase
    .from("jgf_purchases")
    .delete()
    .eq("id", purchaseId);
  query = applyTenantFilter(query, tenantId);
  const { error } = await query;

  if (error) {
    console.error("Error deleting JGF purchase:", error);
    throw new Error("Failed to delete purchase");
  }

  return true;
}

// ===================================
// JGF FARMING & LAND FUNCTIONS
// ===================================

export async function getJgfLandLeases(tenantId, projectId) {
  if (!isSupabaseConfigured) return [];
  let query = supabase
    .from("jgf_land_leases")
    .select("*")
    .order("start_date", { ascending: false });
  if (projectId) {
    query = query.eq("project_id", projectId);
  }
  query = applyTenantFilter(query, tenantId);
  const { data, error } = await query;
  if (error) {
    console.error("Error fetching land leases:", error);
    return [];
  }
  return data;
}

export async function createJgfLandLease(lease, tenantId, projectId) {
  if (!isSupabaseConfigured) return null;
  const user = await getCurrentMember();
  if (!user) return null;

  const { data, error } = await supabase
    .from("jgf_land_leases")
    .insert([
      {
        ...lease,
        created_by: user.auth_id,
        project_id: lease?.project_id ?? projectId ?? null,
        tenant_id: tenantId ?? null,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateJgfLandLease(id, updates, tenantId) {
  if (!isSupabaseConfigured) return null;
  let query = supabase
    .from("jgf_land_leases")
    .update(updates)
    .eq("id", id);
  query = applyTenantFilter(query, tenantId);
  const { data, error } = await query.select().single();

  if (error) throw error;
  return data;
}

export async function deleteJgfLandLease(id, tenantId) {
  if (!isSupabaseConfigured) return null;
  let query = supabase.from("jgf_land_leases").delete().eq("id", id);
  query = applyTenantFilter(query, tenantId);
  const { error } = await query;
  if (error) throw error;
  return true;
}

export async function getJgfCropCycles(tenantId, projectId) {
  if (!isSupabaseConfigured) return [];
  let query = supabase
    .from("jgf_crop_cycles")
    .select(`
      *,
      lease:lease_id (name, location)
    `)
    .order("start_date", { ascending: false });
  if (projectId) {
    query = query.eq("project_id", projectId);
  }
  query = applyTenantFilter(query, tenantId);
  const { data, error } = await query;

  if (error) {
    console.error("Error fetching crop cycles:", error);
    return [];
  }
  return data;
}

export async function createJgfCropCycle(cycle, tenantId, projectId) {
  if (!isSupabaseConfigured) return null;
  const user = await getCurrentMember();
  if (!user) return null;

  const { data, error } = await supabase
    .from("jgf_crop_cycles")
    .insert([
      {
        ...cycle,
        created_by: user.auth_id,
        project_id: cycle?.project_id ?? projectId ?? null,
        tenant_id: tenantId ?? null,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateJgfCropCycle(id, updates, tenantId) {
  if (!isSupabaseConfigured) return null;
  let query = supabase
    .from("jgf_crop_cycles")
    .update(updates)
    .eq("id", id);
  query = applyTenantFilter(query, tenantId);
  const { data, error } = await query.select().single();

  if (error) throw error;
  return data;
}

export async function deleteJgfCropCycle(id, tenantId) {
  if (!isSupabaseConfigured) return null;
  let query = supabase.from("jgf_crop_cycles").delete().eq("id", id);
  query = applyTenantFilter(query, tenantId);
  const { error } = await query;
  if (error) throw error;
  return true;
}

export async function getJgfFarmingLogs(cycleId, tenantId, projectId) {
  if (!isSupabaseConfigured) return [];
  let query = supabase
    .from("jgf_farming_activities")
    .select("*")
    .order("activity_date", { ascending: false });
  if (projectId) {
    query = query.eq("project_id", projectId);
  }
  query = applyTenantFilter(query, tenantId);

  if (cycleId) {
    query = query.eq("cycle_id", cycleId);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching farming logs:", error);
    return [];
  }
  return data;
}

export async function createJgfFarmingLog(log, tenantId, projectId) {
  if (!isSupabaseConfigured) return null;
  const user = await getCurrentMember();
  if (!user) return null;

  const { data, error } = await supabase
    .from("jgf_farming_activities")
    .insert([
      {
        ...log,
        created_by: user.auth_id,
        project_id: log?.project_id ?? projectId ?? null,
        tenant_id: tenantId ?? null,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateJgfFarmingLog(id, updates, tenantId) {
  if (!isSupabaseConfigured) return null;
  let query = supabase
    .from("jgf_farming_activities")
    .update(updates)
    .eq("id", id);
  query = applyTenantFilter(query, tenantId);
  const { data, error } = await query.select().single();

  if (error) throw error;
  return data;
}

export async function deleteJgfFarmingLog(id, tenantId) {
  if (!isSupabaseConfigured) return null;
  let query = supabase.from("jgf_farming_activities").delete().eq("id", id);
  query = applyTenantFilter(query, tenantId);
  const { error } = await query;
  if (error) throw error;
  return true;
}

/**
 * Get blog posts / news
 */
export async function getNews(tenantId) {
  if (!isSupabaseConfigured || !supabase) return [];

  const queryVariants = [
    { select: "*", filters: [{ field: "published", value: true }], orderBy: "date" },
    { select: "*", filters: [{ field: "published", value: true }], orderBy: "date_posted" },
    { select: "*", filters: [], orderBy: "date_posted" },
    { select: "*", filters: [], orderBy: "id" },
  ];

  let data = [];
  let lastError = null;
  for (const variant of queryVariants) {
    let query = supabase.from("blogs").select(variant.select);
    query = applyTenantFilter(query, tenantId);
    variant.filters.forEach((filter) => {
      query = query.eq(filter.field, filter.value);
    });
    query = query.order(variant.orderBy, { ascending: false });

    const result = await query;
    if (!result.error) {
      data = Array.isArray(result.data) ? result.data : [];
      lastError = null;
      break;
    }

    lastError = result.error;
    const recoverable =
      isMissingColumnError(result.error, "published") ||
      isMissingColumnError(result.error, "date") ||
      isMissingColumnError(result.error, "date_posted");
    if (!recoverable) {
      break;
    }
  }

  if (lastError) {
    console.error("Error fetching news:", lastError);
    return [];
  }

  return data || [];
}

export async function getMemberNotifications(tenantId, options = {}) {
  if (!shouldUseSupabase()) {
    return [];
  }

  const limit = Number.parseInt(String(options?.limit || ""), 10);
  let query = supabase
    .from("member_notifications")
    .select(
      "id, tenant_id, member_id, kind, category, type, title, body, action_page, action_label, entity_type, entity_id, priority, status, read_at, remind_at, metadata, created_at, updated_at"
    )
    .order("created_at", { ascending: false });
  query = applyTenantFilter(query, tenantId);
  if (Number.isInteger(limit) && limit > 0) {
    query = query.limit(limit);
  }

  const { data, error } = await query;
  if (error) {
    if (isMissingRelationError(error, "member_notifications")) {
      return [];
    }
    throw error;
  }

  return Array.isArray(data) ? data : [];
}

export async function markMemberNotificationRead(notificationId, read = true) {
  if (!shouldUseSupabase()) {
    throw new Error("Supabase not configured");
  }

  const safeNotificationId = String(notificationId || "").trim();
  if (!safeNotificationId) {
    throw new Error("Notification id is required.");
  }

  const payload = read
    ? { status: "read", read_at: new Date().toISOString() }
    : { status: "unread", read_at: null };

  const { data, error } = await supabase
    .from("member_notifications")
    .update(payload)
    .eq("id", safeNotificationId)
    .select(
      "id, tenant_id, member_id, kind, category, type, title, body, action_page, action_label, entity_type, entity_id, priority, status, read_at, remind_at, metadata, created_at, updated_at"
    )
    .maybeSingle();

  if (error) {
    if (isMissingRelationError(error, "member_notifications")) {
      return null;
    }
    throw error;
  }

  return data || null;
}

export async function markAllMemberNotificationsRead(tenantId) {
  if (!shouldUseSupabase()) {
    throw new Error("Supabase not configured");
  }

  let query = supabase
    .from("member_notifications")
    .update({
      status: "read",
      read_at: new Date().toISOString(),
    })
    .eq("status", "unread");

  query = applyTenantFilter(query, tenantId);
  const { error } = await query;

  if (error) {
    if (isMissingRelationError(error, "member_notifications")) {
      return false;
    }
    throw error;
  }

  return true;
}

export async function refreshMemberNotificationReminders(tenantId = null) {
  if (!shouldUseSupabase()) {
    return null;
  }

  const { data, error } = await supabase.rpc("refresh_member_notification_reminders", {
    p_tenant_id: tenantId || null,
  });

  if (error) {
    if (isMissingRelationError(error, "member_notifications")) {
      return null;
    }
    if (String(error?.code || "") === "42883" || String(error?.message || "").includes("refresh_member_notification_reminders")) {
      return null;
    }
    throw error;
  }

  if (Array.isArray(data)) {
    return data[0] || null;
  }
  return data || null;
}

export async function getOrganizationTemplates(tenantId) {
  if (!isSupabaseConfigured || !supabase) return [];

  const effectiveTenantId = normalizeOptional(tenantId);
  const selectVariants = [
    "id, template_key, tenant_id, name, category, format, description, sections, file_path, mime_type, file_ext, file_size_bytes, is_active, sort_order, created_at, updated_at",
    "id, template_key, tenant_id, name, category, format, description, file_path, mime_type, file_ext, file_size_bytes, is_active, sort_order, created_at, updated_at",
    "id, template_key, tenant_id, name, category, format, description, file_path, is_active, sort_order",
    "id, tenant_id, name, category, format, description, file_path, is_active, sort_order",
  ];

  let data = null;
  let error = null;
  for (const selectColumns of selectVariants) {
    let query = supabase
      .from("organization_templates")
      .select(selectColumns)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (effectiveTenantId) {
      query = query.or(`tenant_id.is.null,tenant_id.eq.${effectiveTenantId}`);
    } else {
      query = query.is("tenant_id", null);
    }

    const result = await query;
    data = result.data;
    error = result.error;
    if (!error) {
      break;
    }
  }

  if (error && isMissingRelationError(error, "organization_templates")) {
    throw new Error(
      "Organization templates table is not available. Run migration_048_organization_templates.sql."
    );
  }

  if (error) {
    console.error("Error fetching organization templates:", error);
    throw error;
  }

  return (Array.isArray(data) ? data : []).map((row) => {
    const sections = Array.isArray(row?.sections)
      ? row.sections.map((section) => String(section || "").trim()).filter(Boolean)
      : [];
    const filePath = normalizeOptional(row?.file_path);
    const category = normalizeOptional(row?.category) || "General Templates";
    const description = normalizeOptional(row?.description);

    return {
      ...row,
      category,
      description: description || "",
      sections,
      file_path: filePath || null,
      format: getTemplateFormatFromMetadata(row),
      can_download: Boolean(filePath),
    };
  });
}

export async function getOrganizationTemplateDownloadUrl(filePath) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  const raw = String(filePath || "").trim();
  if (!raw) {
    throw new Error("Template file path is missing.");
  }

  const publicMarker = `/storage/v1/object/public/${ORGANIZATION_TEMPLATE_BUCKET}/`;
  const signedMarker = `/storage/v1/object/sign/${ORGANIZATION_TEMPLATE_BUCKET}/`;
  const privateMarker = `/storage/v1/object/${ORGANIZATION_TEMPLATE_BUCKET}/`;
  let normalizedPath = raw;
  if (raw.includes(publicMarker)) {
    normalizedPath = raw.split(publicMarker)[1] || "";
  } else if (raw.includes(signedMarker)) {
    normalizedPath = raw.split(signedMarker)[1] || "";
  } else if (raw.includes(privateMarker)) {
    normalizedPath = raw.split(privateMarker)[1] || "";
  }
  normalizedPath = normalizedPath.replace(/\?.*$/, "").trim();
  if (!normalizedPath) {
    throw new Error("Template file path is invalid.");
  }

  const { data: signedData, error: signedError } = await supabase.storage
    .from(ORGANIZATION_TEMPLATE_BUCKET)
    .createSignedUrl(normalizedPath, 60 * 60);

  if (signedError) {
    const message = extractStorageMessage(signedError);
    if (message.includes("not found")) {
      throw new Error("Template file was not found in storage. Re-upload the template and try again.");
    }
    console.error("Error creating signed URL for organization template:", signedError);
    throw signedError;
  }

  return signedData?.signedUrl || null;
}

/**
 * Get documents
 */
export async function getDocuments(tenantId) {
  if (!isSupabaseConfigured || !supabase) return [];

  const looksLikeStoragePath = (value) => /^tenants\/[^/]+\/.+/.test(String(value || "").trim());
  const resolveDocumentPath = (row) => {
    const explicitPath = String(row?.file_path || "").trim();
    if (explicitPath) return explicitPath;
    const legacyFileUrl = String(row?.file_url || "").trim();
    if (looksLikeStoragePath(legacyFileUrl)) return legacyFileUrl;
    return "";
  };

  const selectVariants = [
    "id, tenant_id, name, type, description, file_url, file_path, mime_type, file_ext, file_size_bytes, uploaded_by_member_id, uploaded_at",
    "id, tenant_id, name, type, file_url, file_path, mime_type, file_ext, file_size_bytes, uploaded_by_member_id, uploaded_at",
    "id, tenant_id, name, type, file_url, file_path, uploaded_at",
    "id, tenant_id, name, type, file_url, uploaded_at",
    "id, name, type, file_url, uploaded_at",
  ];

  let data = null;
  let error = null;
  for (const selectColumns of selectVariants) {
    let query = supabase
      .from("documents")
      .select(selectColumns)
      .order("uploaded_at", { ascending: false });
    query = applyTenantFilter(query, tenantId);
    const result = await query;
    data = result.data;
    error = result.error;
    if (!error) {
      break;
    }
  }

  if (error) {
    console.error("Error fetching documents:", error);
    return [];
  }

  const rows = Array.isArray(data) ? data : [];
  const signedUrlMap = new Map();
  const pathsToSign = Array.from(
    new Set(
      rows
        .map((row) => resolveDocumentPath(row))
        .filter(Boolean)
    )
  );

  if (pathsToSign.length) {
    await Promise.all(
      pathsToSign.map(async (path) => {
        const { data: signedData, error: signedError } = await supabase.storage
          .from(PROJECT_DOCUMENT_BUCKET)
          .createSignedUrl(path, 60 * 60);
        if (signedError) {
          console.warn("Error creating signed URL for organization document:", signedError);
          return;
        }
        signedUrlMap.set(path, signedData?.signedUrl || null);
      })
    );
  }

  return rows.map((row) => {
    const storagePath = resolveDocumentPath(row);
    const legacyUrl = String(row?.file_url || "").trim();
    const looksLikeUrl = /^https?:\/\//i.test(legacyUrl);
    const downloadUrl = signedUrlMap.get(storagePath) || (looksLikeUrl ? legacyUrl : null);
    return {
      ...row,
      file_path: storagePath || null,
      download_url: downloadUrl,
      file_url: downloadUrl || legacyUrl || null,
    };
  });
}

export async function uploadOrganizationDocument(file, options = {}, tenantId) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }
  const effectiveTenantId = normalizeOptional(tenantId);
  if (!effectiveTenantId) {
    throw new Error("Tenant is required to upload organization documents.");
  }
  if (!file) {
    throw new Error("Document file is required.");
  }

  const { isAllowed, mimeType, extension } = isAllowedProjectDocumentType(file);
  if (!isAllowed) {
    throw new Error("Only .docx, .pdf, and image files are allowed.");
  }

  const fileSize = Number(file?.size || 0);
  if (!Number.isFinite(fileSize) || fileSize <= 0) {
    throw new Error("Invalid file size.");
  }
  if (fileSize > PROJECT_DOCUMENT_MAX_SIZE_BYTES) {
    throw new Error("File is too large. Maximum allowed size is 25 MB.");
  }

  const safeExtension = extension || (mimeType.startsWith("image/") ? "jpg" : "bin");
  const tenantSegment = sanitizeStorageSegment(effectiveTenantId, "global");
  const safeBaseName = sanitizeDocumentName(file?.name || options?.name || "document");
  const suffix = Math.random().toString(36).slice(2, 10);
  const timestamp = Date.now();
  const fileName = `${timestamp}-${safeBaseName}-${suffix}.${safeExtension}`;
  const filePath = `tenants/${tenantSegment}/organization/documents/${fileName}`;

  const { error: uploadError } = await supabase.storage.from(PROJECT_DOCUMENT_BUCKET).upload(filePath, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || undefined,
  });

  if (uploadError) {
    console.error("Error uploading organization document:", uploadError);
    throw uploadError;
  }

  const uploadedByMemberId = parseOptionalMemberId(options?.uploaded_by_member_id ?? options?.uploadedByMemberId);
  const documentType =
    normalizeOptional(options?.type || options?.documentType || options?.category) ||
    (mimeType.startsWith("image/") ? "Image" : safeExtension.toUpperCase());
  const documentName = normalizeOptional(options?.name) || file?.name || "Document";
  const documentDescription = normalizeOptional(options?.description);

  const insertVariants = [
    {
      tenant_id: effectiveTenantId,
      name: documentName,
      type: documentType,
      description: documentDescription,
      file_url: filePath,
      file_path: filePath,
      mime_type: mimeType || file.type || "application/octet-stream",
      file_ext: safeExtension,
      file_size_bytes: fileSize,
      uploaded_by_member_id: uploadedByMemberId,
      uploaded_at: new Date().toISOString(),
    },
    {
      tenant_id: effectiveTenantId,
      name: documentName,
      type: documentType,
      file_url: filePath,
      file_path: filePath,
      uploaded_at: new Date().toISOString(),
    },
    {
      tenant_id: effectiveTenantId,
      name: documentName,
      type: documentType,
      file_url: filePath,
      uploaded_at: new Date().toISOString(),
    },
    {
      name: documentName,
      type: documentType,
      file_url: filePath,
      uploaded_at: new Date().toISOString(),
    },
  ];

  let data = null;
  let error = null;
  for (const variant of insertVariants) {
    const payload = Object.fromEntries(
      Object.entries(variant).filter(([, value]) => value !== undefined)
    );
    const result = await supabase.from("documents").insert(payload).select("*").single();
    data = result.data;
    error = result.error;
    if (!error) {
      break;
    }
  }

  if (error) {
    try {
      await supabase.storage.from(PROJECT_DOCUMENT_BUCKET).remove([filePath]);
    } catch (cleanupError) {
      console.warn("Failed to cleanup uploaded org document after insert error:", cleanupError);
    }
    console.error("Error creating organization document record:", error);
    throw error;
  }

  const { data: signedData, error: signedError } = await supabase.storage
    .from(PROJECT_DOCUMENT_BUCKET)
    .createSignedUrl(filePath, 60 * 60);
  if (signedError) {
    console.warn("Error creating signed URL for uploaded org document:", signedError);
  }

  return {
    ...data,
    file_path: filePath,
    download_url: signedData?.signedUrl || null,
    file_url: signedData?.signedUrl || data?.file_url || null,
  };
}

export async function renameOrganizationDocument(documentId, name, tenantId) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  const parsedDocumentId = String(documentId || "").trim();
  if (!parsedDocumentId) {
    throw new Error("Document id is required.");
  }

  const nextName = String(name || "").trim();
  if (!nextName) {
    throw new Error("Document name is required.");
  }

  const updateVariants = [
    { name: nextName },
  ];
  const selectVariants = [
    "id, tenant_id, name, type, description, file_url, file_path, mime_type, file_ext, file_size_bytes, uploaded_by_member_id, uploaded_at",
    "id, tenant_id, name, type, file_url, file_path, uploaded_at",
    "id, tenant_id, name, type, file_url, uploaded_at",
    "id, name, type, file_url, uploaded_at",
  ];

  let data = null;
  let error = null;
  for (const payload of updateVariants) {
    for (const selectColumns of selectVariants) {
      let query = supabase
        .from("documents")
        .update(payload)
        .eq("id", parsedDocumentId)
        .select(selectColumns)
        .single();
      query = applyTenantFilter(query, tenantId);
      const result = await query;
      data = result.data;
      error = result.error;
      if (!error) {
        break;
      }
    }
    if (!error) {
      break;
    }
  }

  if (error) {
    console.error("Error renaming organization document:", error);
    throw error;
  }

  const explicitPath = String(data?.file_path || "").trim();
  const fallbackPath =
    /^tenants\/[^/]+\/.+/.test(String(data?.file_url || "").trim()) ? String(data.file_url).trim() : "";
  const path = explicitPath || fallbackPath;
  let downloadUrl = null;
  if (path) {
    const { data: signedData, error: signedError } = await supabase.storage
      .from(PROJECT_DOCUMENT_BUCKET)
      .createSignedUrl(path, 60 * 60);
    if (signedError) {
      console.warn("Error creating signed URL for renamed organization document:", signedError);
    } else {
      downloadUrl = signedData?.signedUrl || null;
    }
  }

  return {
    ...data,
    file_path: path || null,
    download_url: downloadUrl,
    file_url: downloadUrl || data?.file_url || null,
  };
}

export async function deleteOrganizationDocument(documentId, tenantId) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  const parsedDocumentId = String(documentId || "").trim();
  if (!parsedDocumentId) {
    throw new Error("Document id is required.");
  }

  const looksLikeStoragePath = (value) => /^tenants\/[^/]+\/.+/.test(String(value || "").trim());

  const selectVariants = [
    "id, tenant_id, file_path, file_url",
    "id, tenant_id, file_url",
    "id, file_url",
  ];

  let existingDoc = null;
  let existingError = null;
  for (const selectColumns of selectVariants) {
    let query = supabase
      .from("documents")
      .select(selectColumns)
      .eq("id", parsedDocumentId)
      .maybeSingle();
    query = applyTenantFilter(query, tenantId);
    const result = await query;
    existingDoc = result.data;
    existingError = result.error;
    if (!existingError) {
      break;
    }
  }

  if (existingError) {
    console.error("Error loading organization document before delete:", existingError);
    throw existingError;
  }
  if (!existingDoc) {
    return true;
  }

  const explicitPath = String(existingDoc?.file_path || "").trim();
  const pathFromUrl = looksLikeStoragePath(existingDoc?.file_url) ? String(existingDoc?.file_url).trim() : "";
  const storagePath = explicitPath || pathFromUrl;
  if (storagePath) {
    const { error: storageError } = await supabase.storage.from(PROJECT_DOCUMENT_BUCKET).remove([storagePath]);
    if (storageError) {
      const message = extractStorageMessage(storageError);
      if (!message.includes("not found")) {
        console.error("Error deleting organization document file from storage:", storageError);
        throw storageError;
      }
    }
  }

  let deleteQuery = supabase.from("documents").delete().eq("id", parsedDocumentId);
  deleteQuery = applyTenantFilter(deleteQuery, tenantId);
  const { error: deleteError } = await deleteQuery;
  if (deleteError) {
    console.error("Error deleting organization document record:", deleteError);
    throw deleteError;
  }

  return true;
}

const DEFAULT_ORGANIZATION_ACTIVITY_OPTION_VALUES = {
  categories: [
    { value: "General", label: "General" },
    { value: "Sales", label: "Sales" },
    { value: "Expenses", label: "Expenses" },
    { value: "Welfare", label: "Welfare" },
    { value: "Report", label: "Report" },
  ],
  valueTypes: [
    { value: "Income", label: "Income" },
    { value: "Expense", label: "Expense" },
    { value: "Contribution", label: "Contribution" },
  ],
  budgetLines: [
    { value: "Operations", label: "Operations" },
    { value: "Welfare", label: "Welfare" },
    { value: "Projects", label: "Projects" },
    { value: "Administration", label: "Administration" },
  ],
};

const buildDefaultOrganizationActivityOptionValues = () => ({
  categories: DEFAULT_ORGANIZATION_ACTIVITY_OPTION_VALUES.categories.map((item) => ({ ...item })),
  valueTypes: DEFAULT_ORGANIZATION_ACTIVITY_OPTION_VALUES.valueTypes.map((item) => ({ ...item })),
  budgetLines: DEFAULT_ORGANIZATION_ACTIVITY_OPTION_VALUES.budgetLines.map((item) => ({ ...item })),
});

const normalizeActivityOption = (row = {}) => {
  const group = String(row?.option_group || "")
    .trim()
    .toLowerCase();
  const value = String(row?.option_value || "").trim();
  const label = String(row?.option_label || value).trim();
  const displayOrder = Number.isFinite(Number(row?.display_order))
    ? Number(row.display_order)
    : Number.MAX_SAFE_INTEGER;
  if (!group || !value || !label) return null;
  return { group, value, label, displayOrder };
};

const groupActivityOptionRows = (rows = []) => {
  const grouped = {
    categories: [],
    valueTypes: [],
    budgetLines: [],
  };
  rows.forEach((row) => {
    const normalized = normalizeActivityOption(row);
    if (!normalized) return;
    const mapped = { value: normalized.value, label: normalized.label, displayOrder: normalized.displayOrder };
    if (normalized.group === "category") grouped.categories.push(mapped);
    if (normalized.group === "value_type") grouped.valueTypes.push(mapped);
    if (normalized.group === "budget_line") grouped.budgetLines.push(mapped);
  });
  const sortOptions = (items) =>
    items.sort((left, right) => {
      if (left.displayOrder !== right.displayOrder) {
        return left.displayOrder - right.displayOrder;
      }
      return String(left.label).localeCompare(String(right.label));
    });
  sortOptions(grouped.categories);
  sortOptions(grouped.valueTypes);
  sortOptions(grouped.budgetLines);
  return grouped;
};

const mergeActivityOptionRows = (baseRows = [], tenantRows = []) => {
  const merged = new Map();
  (baseRows || []).forEach((row) => {
    const normalized = normalizeActivityOption(row);
    if (!normalized) return;
    merged.set(`${normalized.group}:${normalized.value.toLowerCase()}`, row);
  });
  (tenantRows || []).forEach((row) => {
    const normalized = normalizeActivityOption(row);
    if (!normalized) return;
    merged.set(`${normalized.group}:${normalized.value.toLowerCase()}`, row);
  });
  return Array.from(merged.values());
};

export async function getOrganizationActivityOptionValues(tenantId) {
  const fallback = buildDefaultOrganizationActivityOptionValues();
  if (!isSupabaseConfigured || !supabase) {
    return fallback;
  }

  const selectColumns =
    "id, tenant_id, option_group, option_value, option_label, display_order, is_active";
  let globalQuery = supabase
    .from("organization_activity_option_values")
    .select(selectColumns)
    .eq("is_active", true)
    .is("tenant_id", null)
    .order("display_order", { ascending: true })
    .order("option_label", { ascending: true });
  const globalResult = await globalQuery;

  if (globalResult.error) {
    if (isMissingRelationError(globalResult.error, "organization_activity_option_values")) {
      return fallback;
    }
    console.error("Error loading activity option values:", globalResult.error);
    return fallback;
  }

  let tenantRows = [];
  if (tenantId) {
    let tenantQuery = supabase
      .from("organization_activity_option_values")
      .select(selectColumns)
      .eq("is_active", true)
      .eq("tenant_id", tenantId)
      .order("display_order", { ascending: true })
      .order("option_label", { ascending: true });
    const tenantResult = await tenantQuery;
    if (!tenantResult.error) {
      tenantRows = tenantResult.data || [];
    } else if (!isMissingRelationError(tenantResult.error, "organization_activity_option_values")) {
      console.error("Error loading tenant activity option values:", tenantResult.error);
    }
  }

  const grouped = groupActivityOptionRows(
    mergeActivityOptionRows(globalResult.data || [], tenantRows)
  );

  return {
    categories: grouped.categories.length
      ? grouped.categories.map((item) => ({ value: item.value, label: item.label }))
      : fallback.categories,
    valueTypes: grouped.valueTypes.length
      ? grouped.valueTypes.map((item) => ({ value: item.value, label: item.label }))
      : fallback.valueTypes,
    budgetLines: grouped.budgetLines.length
      ? grouped.budgetLines.map((item) => ({ value: item.value, label: item.label }))
      : fallback.budgetLines,
  };
}

const MEETING_SELECT_VARIANTS = [
  "id, tenant_id, date, type, agenda, minutes, assignees, attendees_data, title, description, notes, location, status, project_id, owner_member_id, start_at, end_at, value_type, budget_line, source_partner_id, source_partner_name, poster_url, poster_path, audience_scope, agenda_items, minutes_data, chairperson_member_id, secretary_member_id, minutes_status, minutes_generated_at, created_at, updated_at",
  "id, tenant_id, date, type, agenda, minutes, attendees, title, description, notes, location, status, project_id, owner_member_id, start_at, end_at, value_type, budget_line, source_partner_id, source_partner_name, poster_url, poster_path, created_at, updated_at",
  "id, tenant_id, date, type, agenda, minutes, attendees, title, description, location, status, project_id, owner_member_id, created_at",
  "id, tenant_id, date, type, agenda, minutes, attendees",
];

const normalizeMeetingDate = (value) => {
  const text = String(value || "").trim();
  if (!text) return null;
  return text.slice(0, 10);
};

const normalizeMeetingStatus = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");
  if (!normalized) return "scheduled";
  if (normalized === "inprogress") return "in_progress";
  return normalized;
};

const normalizeMeetingAudienceScope = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  return normalized === "all_members" ? "all_members" : "selected_members";
};

const normalizeMeetingMinutesStatus = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  return normalized === "finalized" ? "finalized" : "draft";
};

const parseOptionalInteger = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const parseOptionalSubscriberId = (value) => {
  const normalized = String(value || "").trim();
  return normalized || null;
};

const normalizeMeetingMemberIds = (value) => {
  if (Array.isArray(value)) {
    return Array.from(
      new Set(
        value
          .map((item) => Number.parseInt(String(item), 10))
          .filter((item) => Number.isInteger(item) && item > 0)
      )
    );
  }
  const text = String(value || "").trim();
  if (!text) return [];
  return Array.from(
    new Set(
      text
        .split(/[,\n;]/)
        .map((item) => Number.parseInt(String(item || "").trim(), 10))
        .filter((item) => Number.isInteger(item) && item > 0)
    )
  );
};

const normalizeMeetingAttendeesData = (value) => {
  const parsedItems = [];
  if (Array.isArray(value)) {
    parsedItems.push(...value);
  } else if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          parsedItems.push(...parsed);
        } else if (parsed && typeof parsed === "object") {
          parsedItems.push(parsed);
        }
      } catch {
        trimmed
          .split(/[,\n;]/)
          .map((item) => item.trim())
          .filter(Boolean)
          .forEach((item) => parsedItems.push(item));
      }
    } else {
      trimmed
        .split(/[,\n;]/)
        .map((item) => item.trim())
        .filter(Boolean)
        .forEach((item) => parsedItems.push(item));
    }
  } else if (value && typeof value === "object") {
    parsedItems.push(value);
  }

  const normalized = [];
  const seen = new Set();
  parsedItems.forEach((item) => {
    let attendeeType = "member";
    let attendeeId = null;

    if (item && typeof item === "object" && !Array.isArray(item)) {
      attendeeType = String(item.type || item.attendee_type || "member")
        .trim()
        .toLowerCase();
      attendeeId =
        attendeeType === "subscriber"
          ? parseOptionalSubscriberId(item.id || item.subscriber_id)
          : parseOptionalInteger(item.id || item.member_id);
    } else if (typeof item === "string") {
      if (item.includes(":")) {
        const [rawType, rawId] = item.split(":");
        attendeeType = String(rawType || "member")
          .trim()
          .toLowerCase();
        attendeeId =
          attendeeType === "subscriber"
            ? parseOptionalSubscriberId(rawId)
            : parseOptionalInteger(rawId);
      } else {
        attendeeId = parseOptionalInteger(item);
      }
    } else {
      attendeeId = parseOptionalInteger(item);
    }

    if (!attendeeId) return;
    if (attendeeType !== "member" && attendeeType !== "subscriber") return;

    const dedupeKey = `${attendeeType}:${attendeeId}`;
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    normalized.push({ type: attendeeType, id: attendeeId });
  });

  return normalized;
};

const normalizeMeetingAgendaItems = (value) => {
  const items = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value
          .split(/\n+/)
          .map((line) => ({ title: line }))
      : [];

  return items
    .map((item) => {
      if (typeof item === "string") {
        const title = String(item || "").trim();
        return title ? { title, details: "", resolutions: [] } : null;
      }
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return null;
      }
      const title = String(item.title || item.label || item.name || "").trim();
      const details = String(item.details || item.discussion || item.notes || "").trim();
      const resolutions = Array.isArray(item.resolutions)
        ? item.resolutions.map((entry) => String(entry || "").trim()).filter(Boolean)
        : typeof item.resolution === "string" && item.resolution.trim()
          ? [item.resolution.trim()]
          : [];
      if (!title && !details && !resolutions.length) {
        return null;
      }
      return {
        title: title || "Agenda item",
        details,
        resolutions,
      };
    })
    .filter(Boolean);
};

const normalizeMeetingMinutesData = (value) => {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const previousMinutes = source.previous_minutes;
  const financialMatters = source.financial_matters;
  const nextMeeting = source.next_meeting;
  const adjournment = source.adjournment;

  return {
    preliminaries: String(source.preliminaries || "").trim(),
    previous_minutes:
      previousMinutes && typeof previousMinutes === "object" && !Array.isArray(previousMinutes)
        ? {
            status: String(previousMinutes.status || "").trim(),
            notes: String(previousMinutes.notes || "").trim(),
          }
        : {
            status: "",
            notes: "",
          },
    financial_matters:
      financialMatters && typeof financialMatters === "object" && !Array.isArray(financialMatters)
        ? {
            discussion: String(financialMatters.discussion || "").trim(),
            resolution: String(financialMatters.resolution || "").trim(),
          }
        : {
            discussion: "",
            resolution: "",
          },
    next_meeting:
      nextMeeting && typeof nextMeeting === "object" && !Array.isArray(nextMeeting)
        ? {
            date: normalizeMeetingDate(nextMeeting.date),
            note: String(nextMeeting.note || "").trim(),
          }
        : {
            date: null,
            note: "",
          },
    adjournment:
      adjournment && typeof adjournment === "object" && !Array.isArray(adjournment)
        ? {
            time: String(adjournment.time || "").trim(),
            note: String(adjournment.note || "").trim(),
          }
        : {
            time: "",
            note: "",
          },
  };
};

const getMeetingParticipantToken = (value) => {
  if (!value || typeof value !== "object") return "";
  const type = String(value.participant_type || value.type || "").trim().toLowerCase();
  const id =
    type === "subscriber"
      ? parseOptionalSubscriberId(value.subscriber_id || value.id)
      : parseOptionalInteger(value.member_id || value.id);
  if (!id) return "";
  if (type !== "member" && type !== "subscriber") return "";
  return `${type}:${id}`;
};

const toLegacyMeetingAttendees = (assignees = [], attendeesData = []) => {
  const attendeeIds = (Array.isArray(attendeesData) ? attendeesData : [])
    .filter((item) => String(item?.type || "").toLowerCase() === "member")
    .map((item) => Number.parseInt(String(item?.id || ""), 10))
    .filter((item) => Number.isInteger(item) && item > 0);
  return Array.from(new Set([...(assignees || []), ...attendeeIds]));
};

const buildOrganizationActivityBasePayload = (payload = {}, tenantId) => {
  const assignees = normalizeMeetingMemberIds(payload?.assignees);
  const attendeesData = normalizeMeetingAttendeesData(payload?.attendees);
  const nextDate = normalizeMeetingDate(payload?.date) || new Date().toISOString().slice(0, 10);
  return {
    tenant_id: tenantId ?? normalizeOptional(payload?.tenant_id),
    date: nextDate,
    type: normalizeOptional(payload?.type) || "General",
    agenda: normalizeOptional(payload?.agenda || payload?.title),
    minutes: normalizeOptional(payload?.minutes),
    attendees: toLegacyMeetingAttendees(assignees, attendeesData),
  };
};

const buildOrganizationActivityPayload = (payload = {}, tenantId) => {
  const base = buildOrganizationActivityBasePayload(payload, tenantId);
  const assignees = normalizeMeetingMemberIds(payload?.assignees);
  const attendeesData = normalizeMeetingAttendeesData(payload?.attendees);
  const explicitOwner = parseOptionalInteger(payload?.owner_member_id);
  return {
    tenant_id: base.tenant_id,
    date: base.date,
    type: base.type,
    agenda: base.agenda,
    minutes: base.minutes,
    title: normalizeOptional(payload?.title),
    description: normalizeOptional(payload?.description),
    notes: normalizeOptional(payload?.notes),
    location: normalizeOptional(payload?.location),
    status: normalizeMeetingStatus(payload?.status),
    project_id: parseOptionalInteger(payload?.project_id),
    owner_member_id: explicitOwner ?? assignees[0] ?? null,
    start_at: normalizeOptional(payload?.start_at),
    end_at: normalizeOptional(payload?.end_at),
    value_type: normalizeOptional(payload?.value_type),
    budget_line: normalizeOptional(payload?.budget_line),
    source_partner_id: normalizeOptional(payload?.source_partner_id),
    source_partner_name: normalizeOptional(payload?.source_partner_name),
    poster_url: normalizeOptional(payload?.poster_url),
    poster_path: normalizeOptional(payload?.poster_path),
    audience_scope: normalizeMeetingAudienceScope(payload?.audience_scope),
    agenda_items: normalizeMeetingAgendaItems(payload?.agenda_items),
    minutes_data: normalizeMeetingMinutesData(payload?.minutes_data),
    chairperson_member_id: parseOptionalInteger(payload?.chairperson_member_id),
    secretary_member_id: parseOptionalInteger(payload?.secretary_member_id),
    minutes_status: normalizeMeetingMinutesStatus(payload?.minutes_status),
    assignees,
    attendees_data: attendeesData,
  };
};

const buildOrganizationActivityLegacyPayload = (payload = {}, tenantId) => {
  const base = buildOrganizationActivityBasePayload(payload, tenantId);
  const assignees = normalizeMeetingMemberIds(payload?.assignees);
  const explicitOwner = parseOptionalInteger(payload?.owner_member_id);
  return {
    ...base,
    title: normalizeOptional(payload?.title),
    description: normalizeOptional(payload?.description),
    notes: normalizeOptional(payload?.notes),
    location: normalizeOptional(payload?.location),
    status: normalizeMeetingStatus(payload?.status),
    project_id: parseOptionalInteger(payload?.project_id),
    owner_member_id: explicitOwner ?? assignees[0] ?? null,
    start_at: normalizeOptional(payload?.start_at),
    end_at: normalizeOptional(payload?.end_at),
    value_type: normalizeOptional(payload?.value_type),
    budget_line: normalizeOptional(payload?.budget_line),
    source_partner_id: normalizeOptional(payload?.source_partner_id),
    source_partner_name: normalizeOptional(payload?.source_partner_name),
    poster_url: normalizeOptional(payload?.poster_url),
    poster_path: normalizeOptional(payload?.poster_path),
  };
};

const buildOrganizationActivityLegacyMinimalPayload = (payload = {}, tenantId) => {
  const base = buildOrganizationActivityBasePayload(payload, tenantId);
  const assignees = normalizeMeetingMemberIds(payload?.assignees);
  const explicitOwner = parseOptionalInteger(payload?.owner_member_id);
  return {
    ...base,
    title: normalizeOptional(payload?.title),
    description: normalizeOptional(payload?.description),
    notes: normalizeOptional(payload?.notes),
    location: normalizeOptional(payload?.location),
    status: normalizeMeetingStatus(payload?.status),
    project_id: parseOptionalInteger(payload?.project_id),
    owner_member_id: explicitOwner ?? assignees[0] ?? null,
    start_at: normalizeOptional(payload?.start_at),
    end_at: normalizeOptional(payload?.end_at),
  };
};

const ORGANIZATION_ACTIVITY_EXTENDED_COLUMNS = [
  "assignees",
  "attendees_data",
  "value_type",
  "budget_line",
  "source_partner_id",
  "source_partner_name",
  "poster_url",
  "poster_path",
  "audience_scope",
  "agenda_items",
  "minutes_data",
  "chairperson_member_id",
  "secretary_member_id",
  "minutes_status",
  "minutes_generated_at",
];

const ORGANIZATION_ACTIVITY_METADATA_COLUMNS = [
  "value_type",
  "budget_line",
  "source_partner_id",
  "source_partner_name",
  "poster_url",
  "poster_path",
];

const ORGANIZATION_ACTIVITY_SCHEMA_ERROR =
  "Activity save failed because your database schema is outdated. Run migrations `migration_052_meetings_assignees_attendees.sql`, `migration_054_activity_option_values.sql`, and `migration_071_meeting_minutes_participants.sql`, then retry.";

const hasOrganizationActivityExtendedFields = (payload = {}) => {
  const assignees = normalizeMeetingMemberIds(payload?.assignees);
  const attendeesData = normalizeMeetingAttendeesData(payload?.attendees);
  const normalizeText = (value) => String(value || "").trim();
  return (
    assignees.length > 0 ||
    attendeesData.length > 0 ||
    Boolean(normalizeText(payload?.value_type)) ||
    Boolean(normalizeText(payload?.budget_line)) ||
    Boolean(normalizeText(payload?.source_partner_id)) ||
    Boolean(normalizeText(payload?.source_partner_name)) ||
    Boolean(normalizeText(payload?.poster_url)) ||
    Boolean(normalizeText(payload?.poster_path)) ||
    normalizeMeetingAudienceScope(payload?.audience_scope) === "all_members" ||
    normalizeMeetingAgendaItems(payload?.agenda_items).length > 0 ||
    Object.values(normalizeMeetingMinutesData(payload?.minutes_data)).some((value) =>
      typeof value === "string"
        ? Boolean(value)
        : value && typeof value === "object"
          ? Object.values(value).some(Boolean)
          : false
    ) ||
    Boolean(parseOptionalInteger(payload?.chairperson_member_id)) ||
    Boolean(parseOptionalInteger(payload?.secretary_member_id)) ||
    normalizeMeetingMinutesStatus(payload?.minutes_status) === "finalized"
  );
};

const isMissingAnyColumnError = (error, columns = []) =>
  columns.some((columnName) => isMissingColumnError(error, columnName));

const buildDesiredMeetingParticipants = async (payload = {}, tenantId) => {
  const audienceScope = normalizeMeetingAudienceScope(payload?.audience_scope);
  const explicitAttendees = normalizeMeetingAttendeesData(payload?.attendees);
  const participantMap = new Map();

  explicitAttendees.forEach((entry) => {
    const token = `${entry.type}:${entry.id}`;
    participantMap.set(token, {
      participant_type: entry.type,
      member_id: entry.type === "member" ? entry.id : null,
      subscriber_id: entry.type === "subscriber" ? entry.id : null,
    });
  });

  if (audienceScope === "all_members") {
    if (!tenantId) {
      throw new Error("Tenant is required to invite all members to a meeting.");
    }
    const { data, error } = await supabase
      .from("tenant_members")
      .select("member_id")
      .eq("tenant_id", tenantId)
      .eq("status", "active");

    if (error) {
      throw error;
    }

    (data || []).forEach((row) => {
      const memberId = Number.parseInt(String(row?.member_id || ""), 10);
      if (!Number.isInteger(memberId) || memberId <= 0) return;
      participantMap.set(`member:${memberId}`, {
        participant_type: "member",
        member_id: memberId,
        subscriber_id: null,
      });
    });
  }

  return Array.from(participantMap.values());
};

const syncMeetingParticipantsInternal = async (meetingRecord, payload = {}, tenantId) => {
  const parsedMeetingId = Number.parseInt(String(meetingRecord?.id || ""), 10);
  const effectiveTenantId = normalizeOptional(tenantId ?? meetingRecord?.tenant_id);
  if (!Number.isInteger(parsedMeetingId) || parsedMeetingId <= 0 || !effectiveTenantId) {
    return [];
  }

  const desiredParticipants = await buildDesiredMeetingParticipants(payload, effectiveTenantId);
  let currentQuery = supabase
    .from("meeting_participants")
    .select("id, meeting_id, tenant_id, participant_type, member_id, subscriber_id, rsvp_status, attendance_status, notes")
    .eq("meeting_id", parsedMeetingId);
  currentQuery = applyTenantFilter(currentQuery, effectiveTenantId);
  const currentResult = await currentQuery;

  if (currentResult.error) {
    if (isMissingRelationError(currentResult.error, "meeting_participants")) {
      throw new Error(ORGANIZATION_ACTIVITY_SCHEMA_ERROR);
    }
    throw currentResult.error;
  }

  const currentRows = currentResult.data || [];
  const currentByToken = new Map(
    currentRows
      .map((row) => [getMeetingParticipantToken(row), row])
      .filter(([token]) => Boolean(token))
  );
  const desiredByToken = new Map(
    desiredParticipants
      .map((row) => [getMeetingParticipantToken(row), row])
      .filter(([token]) => Boolean(token))
  );

  const removeIds = currentRows
    .filter((row) => !desiredByToken.has(getMeetingParticipantToken(row)))
    .map((row) => row.id)
    .filter(Boolean);

  if (removeIds.length) {
    let deleteQuery = supabase.from("meeting_participants").delete().in("id", removeIds);
    deleteQuery = applyTenantFilter(deleteQuery, effectiveTenantId);
    const { error } = await deleteQuery;
    if (error) {
      throw error;
    }
  }

  const inserts = desiredParticipants
    .filter((row) => !currentByToken.has(getMeetingParticipantToken(row)))
    .map((row) => ({
      meeting_id: parsedMeetingId,
      tenant_id: effectiveTenantId,
      participant_type: row.participant_type,
      member_id: row.member_id,
      subscriber_id: row.subscriber_id,
      invited_at: new Date().toISOString(),
    }));

  if (inserts.length) {
    let insertQuery = supabase.from("meeting_participants").insert(inserts);
    const insertResult = await insertQuery.select("id, meeting_id, tenant_id, participant_type, member_id, subscriber_id, rsvp_status, attendance_status, notes");
    if (insertResult.error) {
      throw insertResult.error;
    }
  }

  const rosterSnapshot = desiredParticipants.map((row) => ({
    type: row.participant_type,
    id: row.participant_type === "subscriber" ? row.subscriber_id : row.member_id,
  }));

  const updateResult = await supabase
    .from("meetings")
    .update({
      attendees_data: rosterSnapshot,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsedMeetingId)
    .eq("tenant_id", effectiveTenantId)
    .select("id")
    .maybeSingle();

  if (updateResult.error && !isMissingColumnError(updateResult.error, "attendees_data")) {
    throw updateResult.error;
  }

  let finalQuery = supabase
    .from("meeting_participants")
    .select("id, meeting_id, tenant_id, participant_type, member_id, subscriber_id, rsvp_status, attendance_status, notes, invited_at, responded_at, attendance_marked_at, attendance_marked_by, created_at, updated_at")
    .eq("meeting_id", parsedMeetingId);
  finalQuery = applyTenantFilter(finalQuery, effectiveTenantId);
  const finalResult = await finalQuery;
  if (finalResult.error) {
    throw finalResult.error;
  }
  return finalResult.data || [];
};

/**
 * Create organization activity
 */
export async function createOrganizationActivity(payload = {}, tenantId) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  const fullPayload = buildOrganizationActivityPayload(payload, tenantId);
  const legacyPayload = buildOrganizationActivityLegacyPayload(payload, tenantId);
  const legacyMinimalPayload = buildOrganizationActivityLegacyMinimalPayload(payload, tenantId);
  const basePayload = buildOrganizationActivityBasePayload(payload, tenantId);
  const requiresExtendedSchema = hasOrganizationActivityExtendedFields(payload);

  let result = await supabase.from("meetings").insert(fullPayload).select("*").single();
  if (result.error && isMissingAnyColumnError(result.error, ORGANIZATION_ACTIVITY_EXTENDED_COLUMNS)) {
    if (requiresExtendedSchema) {
      throw new Error(ORGANIZATION_ACTIVITY_SCHEMA_ERROR);
    }
    result = await supabase.from("meetings").insert(legacyPayload).select("*").single();
  }
  if (
    result.error &&
    isMissingAnyColumnError(result.error, ORGANIZATION_ACTIVITY_METADATA_COLUMNS)
  ) {
    if (requiresExtendedSchema) {
      throw new Error(ORGANIZATION_ACTIVITY_SCHEMA_ERROR);
    }
    result = await supabase.from("meetings").insert(legacyMinimalPayload).select("*").single();
  }
  if (result.error && isMissingColumnError(result.error, "title")) {
    result = await supabase.from("meetings").insert(basePayload).select("*").single();
  }
  if (result.error) {
    console.error("Error creating organization activity:", result.error);
    if (String(result.error?.code || "") === "42501") {
      throw new Error("You do not have permission to create activities for this organization.");
    }
    throw new Error(result.error?.message || "Failed to create organization activity.");
  }
  await syncMeetingParticipantsInternal(result.data, payload, tenantId);
  return result.data;
}

/**
 * Update organization activity
 */
export async function updateOrganizationActivity(activityId, payload = {}, tenantId) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  const parsedActivityId = Number.parseInt(String(activityId), 10);
  if (!Number.isInteger(parsedActivityId) || parsedActivityId <= 0) {
    throw new Error("Valid activity id is required.");
  }

  const fullPayload = buildOrganizationActivityPayload(payload, tenantId);
  const legacyPayload = buildOrganizationActivityLegacyPayload(payload, tenantId);
  const legacyMinimalPayload = buildOrganizationActivityLegacyMinimalPayload(payload, tenantId);
  const basePayload = buildOrganizationActivityBasePayload(payload, tenantId);
  const requiresExtendedSchema = hasOrganizationActivityExtendedFields(payload);

  let query = supabase.from("meetings").update(fullPayload).eq("id", parsedActivityId);
  query = applyTenantFilter(query, tenantId);
  let result = await query.select("*").single();

  if (result.error && isMissingAnyColumnError(result.error, ORGANIZATION_ACTIVITY_EXTENDED_COLUMNS)) {
    if (requiresExtendedSchema) {
      throw new Error(ORGANIZATION_ACTIVITY_SCHEMA_ERROR);
    }
    let legacyQuery = supabase
      .from("meetings")
      .update(legacyPayload)
      .eq("id", parsedActivityId);
    legacyQuery = applyTenantFilter(legacyQuery, tenantId);
    result = await legacyQuery.select("*").single();
  }

  if (
    result.error &&
    isMissingAnyColumnError(result.error, ORGANIZATION_ACTIVITY_METADATA_COLUMNS)
  ) {
    if (requiresExtendedSchema) {
      throw new Error(ORGANIZATION_ACTIVITY_SCHEMA_ERROR);
    }
    let legacyMinimalQuery = supabase
      .from("meetings")
      .update(legacyMinimalPayload)
      .eq("id", parsedActivityId);
    legacyMinimalQuery = applyTenantFilter(legacyMinimalQuery, tenantId);
    result = await legacyMinimalQuery.select("*").single();
  }

  if (result.error && isMissingColumnError(result.error, "title")) {
    let fallbackQuery = supabase
      .from("meetings")
      .update(basePayload)
      .eq("id", parsedActivityId);
    fallbackQuery = applyTenantFilter(fallbackQuery, tenantId);
    result = await fallbackQuery.select("*").single();
  }

  if (result.error) {
    console.error("Error updating organization activity:", result.error);
    if (String(result.error?.code || "") === "42501") {
      throw new Error("You do not have permission to update this activity.");
    }
    throw new Error(result.error?.message || "Failed to update organization activity.");
  }

  await syncMeetingParticipantsInternal(result.data, payload, tenantId);
  return result.data;
}

/**
 * Delete organization activities
 */
export async function deleteOrganizationActivities(activityIds = [], tenantId) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  const normalizedIds = Array.from(
    new Set(
      (Array.isArray(activityIds) ? activityIds : [activityIds])
        .map((value) => Number.parseInt(String(value), 10))
        .filter((value) => Number.isInteger(value) && value > 0)
    )
  );
  if (!normalizedIds.length) {
    return 0;
  }

  let query = supabase.from("meetings").delete().in("id", normalizedIds);
  query = applyTenantFilter(query, tenantId);
  const { error } = await query;

  if (error) {
    console.error("Error deleting organization activities:", error);
    if (String(error?.code || "") === "42501") {
      throw new Error("You do not have permission to delete the selected activities.");
    }
    throw new Error(error?.message || "Failed to delete organization activities.");
  }

  return normalizedIds.length;
}

/**
 * Get meetings
 */
export async function getMeetings(tenantId) {
  if (!isSupabaseConfigured || !supabase) return [];

  for (const selectColumns of MEETING_SELECT_VARIANTS) {
    let query = supabase
      .from("meetings")
      .select(selectColumns)
      .order("date", { ascending: false });
    query = applyTenantFilter(query, tenantId);
    const { data, error } = await query;

    if (error) {
      if (
        isMissingAnyColumnError(error, [
          "assignees",
          "attendees_data",
          "title",
          "description",
          "notes",
          "location",
          "status",
          "project_id",
          "owner_member_id",
          "start_at",
          "end_at",
          "value_type",
          "budget_line",
          "source_partner_id",
          "source_partner_name",
          "poster_url",
          "poster_path",
          "audience_scope",
          "agenda_items",
          "minutes_data",
          "chairperson_member_id",
          "secretary_member_id",
          "minutes_status",
          "minutes_generated_at",
        ])
      ) {
        continue;
      }
      console.error("Error fetching meetings:", error);
      return [];
    }

    return (data || []).map((row) => {
      const normalizedAssignees = normalizeMeetingMemberIds(
        Array.isArray(row?.assignees) && row.assignees.length ? row.assignees : row?.attendees
      );
      const normalizedAttendeesData = normalizeMeetingAttendeesData(
        row?.attendees_data ?? row?.attendees
      );
      const normalizedAttendees = toLegacyMeetingAttendees(
        normalizedAssignees,
        normalizedAttendeesData
      );
      return {
        ...row,
        assignees: normalizedAssignees,
        attendees_data: normalizedAttendeesData,
        attendees: normalizedAttendees,
      };
    });
  }

  return [];
}

export async function getMeetingParticipants(tenantId, meetingIds = []) {
  if (!isSupabaseConfigured || !supabase) return [];

  let query = supabase
    .from("meeting_participants")
    .select(
      `
      id,
      meeting_id,
      tenant_id,
      participant_type,
      member_id,
      subscriber_id,
      rsvp_status,
      attendance_status,
      invited_at,
      responded_at,
      attendance_marked_at,
      attendance_marked_by,
      notes,
      created_at,
      updated_at,
      member:members!meeting_participants_member_id_fkey (id, name, email, phone_number, role),
      subscriber:newsletter_subscribers (id, name, email, contact)
    `
    )
    .order("created_at", { ascending: true });
  query = applyTenantFilter(query, tenantId);

  const normalizedMeetingIds = Array.from(
    new Set(
      (Array.isArray(meetingIds) ? meetingIds : [meetingIds])
        .map((value) => Number.parseInt(String(value || ""), 10))
        .filter((value) => Number.isInteger(value) && value > 0)
    )
  );
  if (normalizedMeetingIds.length) {
    query = query.in("meeting_id", normalizedMeetingIds);
  }

  const { data, error } = await query;
  if (error) {
    if (isMissingRelationError(error, "meeting_participants")) {
      return [];
    }
    console.error("Error fetching meeting participants:", error);
    throw error;
  }

  return (data || []).map((row) => ({
    ...row,
    token: getMeetingParticipantToken(row),
  }));
}

export async function respondMeetingInvitation(meetingId, rsvpStatus) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  const parsedMeetingId = Number.parseInt(String(meetingId || ""), 10);
  if (!Number.isInteger(parsedMeetingId) || parsedMeetingId <= 0) {
    throw new Error("Valid meeting id is required.");
  }

  const normalizedStatus = String(rsvpStatus || "")
    .trim()
    .toLowerCase();
  if (!["confirmed", "declined", "apology"].includes(normalizedStatus)) {
    throw new Error("Invalid RSVP status.");
  }

  const { data, error } = await supabase.rpc("respond_meeting_invitation", {
    p_meeting_id: parsedMeetingId,
    p_rsvp_status: normalizedStatus,
  });

  if (error) {
    console.error("Error responding to meeting invitation:", error);
    throw error;
  }

  return data || null;
}

export async function updateMeetingParticipants(participantUpdates = [], tenantId, actorMemberId = null) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  const updates = Array.isArray(participantUpdates) ? participantUpdates : [participantUpdates];
  const results = [];

  for (const entry of updates) {
    const participantId = Number.parseInt(String(entry?.id || ""), 10);
    if (!Number.isInteger(participantId) || participantId <= 0) {
      continue;
    }

    const nextPayload = {};
    if (Object.prototype.hasOwnProperty.call(entry || {}, "rsvp_status")) {
      const rsvpStatus = String(entry?.rsvp_status || "")
        .trim()
        .toLowerCase();
      if (["pending", "confirmed", "declined", "apology"].includes(rsvpStatus)) {
        nextPayload.rsvp_status = rsvpStatus;
        nextPayload.responded_at = rsvpStatus === "pending" ? null : new Date().toISOString();
      }
    }
    if (Object.prototype.hasOwnProperty.call(entry || {}, "attendance_status")) {
      const attendanceStatus = String(entry?.attendance_status || "")
        .trim()
        .toLowerCase();
      if (["unknown", "attended", "absent"].includes(attendanceStatus)) {
        nextPayload.attendance_status = attendanceStatus;
        nextPayload.attendance_marked_at =
          attendanceStatus === "unknown" ? null : new Date().toISOString();
        nextPayload.attendance_marked_by =
          attendanceStatus === "unknown" ? null : parseOptionalInteger(actorMemberId);
      }
    }
    if (Object.prototype.hasOwnProperty.call(entry || {}, "notes")) {
      nextPayload.notes = normalizeOptional(entry?.notes);
    }

    if (!Object.keys(nextPayload).length) {
      continue;
    }

    let query = supabase
      .from("meeting_participants")
      .update(nextPayload)
      .eq("id", participantId);
    query = applyTenantFilter(query, tenantId);
    const { data, error } = await query.select("*").single();

    if (error) {
      console.error("Error updating meeting participant:", error);
      throw error;
    }
    results.push(data);
  }

  return results;
}

export async function finalizeMeetingAttendance(meetingId, tenantId, actorMemberId = null) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  const parsedMeetingId = Number.parseInt(String(meetingId || ""), 10);
  if (!Number.isInteger(parsedMeetingId) || parsedMeetingId <= 0) {
    throw new Error("Valid meeting id is required.");
  }

  let query = supabase
    .from("meeting_participants")
    .update({
      attendance_status: "absent",
      attendance_marked_at: new Date().toISOString(),
      attendance_marked_by: parseOptionalInteger(actorMemberId),
    })
    .eq("meeting_id", parsedMeetingId)
    .eq("attendance_status", "unknown");
  query = applyTenantFilter(query, tenantId);
  const { error } = await query;
  if (error) {
    console.error("Error finalizing meeting attendance:", error);
    throw error;
  }

  const meetingPayload = {
    minutes_status: "finalized",
    minutes_generated_at: new Date().toISOString(),
  };
  let meetingQuery = supabase
    .from("meetings")
    .update(meetingPayload)
    .eq("id", parsedMeetingId);
  meetingQuery = applyTenantFilter(meetingQuery, tenantId);
  const meetingResult = await meetingQuery.select("*").single();

  if (meetingResult.error && isMissingColumnError(meetingResult.error, "minutes_generated_at")) {
    let fallbackQuery = supabase
      .from("meetings")
      .update({ minutes_status: "finalized" })
      .eq("id", parsedMeetingId);
    fallbackQuery = applyTenantFilter(fallbackQuery, tenantId);
    const fallbackResult = await fallbackQuery.select("*").single();
    if (fallbackResult.error) {
      throw fallbackResult.error;
    }
    return fallbackResult.data;
  }

  if (meetingResult.error) {
    console.error("Error updating meeting finalize state:", meetingResult.error);
    throw meetingResult.error;
  }

  return meetingResult.data;
}

/**
 * Get all members (for payout schedule display)
 */
export async function getAllMembers() {
  if (!isSupabaseConfigured || !supabase) return [];

  const { data, error } = await supabase
    .from("members")
    .select("id, name, status")
    .eq("status", "active")
    .order("name", { ascending: true });

  if (error) {
    console.error("Error fetching members:", error);
    return [];
  }

  return data || [];
}

/**
 * Update member profile
 */
export async function updateMemberProfile(memberId, updates) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase not configured");
  }

  const { data, error } = await supabase
    .from("members")
    .update(updates)
    .eq("id", memberId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Get dashboard overview stats for a member
 */
export async function getDashboardStats(memberId, tenantId) {
  // Mock fallback data for development
  const mockStats = {
    totalContributions: 0,
    welfareBalance: 0,
    payoutTurn: null,
    payoutDate: null,
    currentCycle: 0,
    totalMembers: 0,
    nextRecipient: null,
    nextPayoutDate: null,
  };

  if (!isSupabaseConfigured || !supabase) return mockStats;

  try {
    // Get member's total contributions
    let contributionsQuery = supabase
      .from("contributions")
      .select("amount")
      .eq("member_id", memberId);
    contributionsQuery = applyTenantFilter(contributionsQuery, tenantId);
    const { data: contributions } = await contributionsQuery;

    const totalContributions = contributions?.reduce((sum, c) => sum + Number(c.amount), 0) ?? 0;

    // Get member's payout info
    let payoutQuery = supabase
      .from("payouts")
      .select("cycle_number, date, amount")
      .eq("member_id", memberId);
    payoutQuery = applyTenantFilter(payoutQuery, tenantId);
    const { data: payout } = await payoutQuery.maybeSingle();

    // Get current cycle from welfare_cycles (completed cycles)
    const today = new Date().toISOString().split('T')[0];
    let cyclesQuery = supabase
      .from("welfare_cycles")
      .select("id, total_contributed, total_disbursed, end_date")
      .lte("end_date", today);
    cyclesQuery = applyTenantFilter(cyclesQuery, tenantId);
    const { data: completedCycles } = await cyclesQuery;

    const currentCycle = completedCycles?.length ?? 0;
    const latestCompleted = completedCycles?.[completedCycles.length - 1];

    // Get welfare balance (total group welfare)
    let balanceQuery = supabase
      .from("welfare_balances")
      .select("balance")
      .order("cycle_id", { ascending: false })
      .limit(1);
    balanceQuery = applyTenantFilter(balanceQuery, tenantId);
    const { data: welfareData } = await balanceQuery.maybeSingle();

    const welfareBalance =
      welfareData?.balance ??
      (latestCompleted
        ? Number(latestCompleted.total_contributed || 0) -
          Number(latestCompleted.total_disbursed || 0)
        : 0);

    // Get next upcoming payout
    let nextPayoutQuery = supabase
      .from("payouts")
      .select(`
        date,
        members (name)
      `)
      .gt("date", today)
      .order("date", { ascending: true })
      .limit(1);
    nextPayoutQuery = applyTenantFilter(nextPayoutQuery, tenantId);
    const { data: nextPayout } = await nextPayoutQuery.maybeSingle();

    // Get total members count
    let totalMembers = 0;
    if (tenantId) {
      const { count } = await supabase
        .from("tenant_members")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId);
      totalMembers = count ?? 0;
    } else {
      const { count } = await supabase
        .from("members")
        .select("id", { count: "exact", head: true })
        .eq("status", "active");
      totalMembers = count ?? 0;
    }

    return {
      totalContributions: totalContributions ?? 0,
      welfareBalance: welfareBalance ?? 0,
      payoutTurn: payout?.cycle_number ?? null,
      payoutDate: payout?.date ?? null,
      currentCycle: currentCycle ?? 0,
      totalMembers,
      nextRecipient: nextPayout?.members?.name ?? null,
      nextPayoutDate: nextPayout?.date ?? null,
    };
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return {
      totalContributions: 0,
      welfareBalance: 0,
      payoutTurn: null,
      payoutDate: null,
      currentCycle: 0,
      totalMembers: 0,
      nextRecipient: null,
      nextPayoutDate: null,
    };
  }
}

const ADMIN_ROLES = ["admin", "superadmin"];

function normalizeOptional(value) {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = typeof value === "string" ? value.trim() : value;
  return trimmed === "" ? null : trimmed;
}

function applyTenantFilter(query, tenantId) {
  if (!tenantId) {
    return query;
  }
  return query.eq("tenant_id", tenantId);
}

function generateInviteCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const length = 12;
  const bytes = new Uint8Array(length);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  const chars = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
  return `JNG-${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8, 12)}`;
}

async function hashInviteCode(code) {
  if (typeof crypto === "undefined" || !crypto.subtle) {
    return code;
  }
  const data = new TextEncoder().encode(code);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function isAdminUser(user) {
  const role = user?.role || "";
  return ADMIN_ROLES.includes(role);
}

export async function getMembersAdmin(tenantId) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase not configured");
  }

  const selectCore =
    "id, name, email, phone_number, role, status, join_date, auth_id, gender, national_id, occupation, address, county, sub_county, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship";
  const selectWithAvatar = `${selectCore}, avatar_url`;
  const selectWithAvatarAndBio = `${selectWithAvatar}, bio`;
  const selectWithBio = `${selectCore}, bio`;
  let memberIds = null;
  let membershipMap = null;
  if (tenantId) {
    const { data: membershipRows, error: membershipError } = await supabase
      .from("tenant_members")
      .select("id, member_id, role, status, created_at, updated_at")
      .eq("tenant_id", tenantId);
    if (membershipError) {
      throw membershipError;
    }
    memberIds = (membershipRows || []).map((row) => row.member_id).filter(Boolean);
    if (!memberIds.length) {
      return [];
    }
    membershipMap = new Map(
      (membershipRows || [])
        .filter((row) => row?.member_id)
        .map((row) => [
          row.member_id,
          {
            tenant_membership_id: row.id || null,
            tenant_role: normalizeOptional(row.role) || "member",
            tenant_status: normalizeOptional(row.status) || "active",
            tenant_joined_at: normalizeOptional(row.created_at),
            tenant_membership_updated_at: normalizeOptional(row.updated_at),
          },
        ])
    );
  }

  const runMemberQuery = (selectColumns) => {
    let query = supabase.from("members").select(selectColumns).order("name", { ascending: true });
    if (Array.isArray(memberIds)) {
      query = query.in("id", memberIds);
    }
    return query;
  };

  const selectVariants = [selectWithAvatarAndBio, selectWithAvatar, selectWithBio, selectCore];
  let data = null;
  let error = null;
  for (const columns of selectVariants) {
    const result = await runMemberQuery(columns);
    data = result.data;
    error = result.error;
    if (!error) {
      break;
    }
    const isRecoverableMissingColumn =
      isMissingColumnError(error, "bio") || isMissingColumnError(error, "avatar_url");
    if (!isRecoverableMissingColumn) {
      break;
    }
  }

  if (error) {
    throw error;
  }

  if (!tenantId || !membershipMap) {
    return data || [];
  }

  return (data || [])
    .map((member) => ({
      ...member,
      ...(membershipMap.get(member?.id) || {}),
    }))
    .sort((left, right) => String(left?.name || "").localeCompare(String(right?.name || "")));
}

export async function getProjectAssignableMembers(currentMemberId, tenantId) {
  const parsedCurrentMemberId = Number.parseInt(String(currentMemberId), 10);

  if (!isSupabaseConfigured || !supabase) {
    if (Number.isInteger(parsedCurrentMemberId) && parsedCurrentMemberId > 0) {
      return [
        {
          id: parsedCurrentMemberId,
          name: "Current user",
          email: null,
          phone_number: null,
          role: "member",
        },
      ];
    }
    return [];
  }

  try {
    const members = await getMembersAdmin(tenantId);
    return (members || [])
      .map((member) => ({
        id: member.id,
        name: member.name || `Member #${member.id}`,
        email: member.email || null,
        phone_number: member.phone_number || null,
        role: member.role || "member",
      }))
      .filter((member) => Number.isInteger(member.id))
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  } catch (error) {
    console.warn("Falling back to current member for assignable members:", error);
  }

  if (!Number.isInteger(parsedCurrentMemberId) || parsedCurrentMemberId <= 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("members")
    .select("id, name, email, phone_number, role")
    .eq("id", parsedCurrentMemberId)
    .maybeSingle();

  if (error) {
    console.error("Error fetching current member as fallback:", error);
    return [];
  }

  if (!data) {
    return [];
  }

  return [
    {
      id: data.id,
      name: data.name || `Member #${data.id}`,
      email: data.email || null,
      phone_number: data.phone_number || null,
      role: data.role || "member",
    },
  ];
}

export async function createProjectMemberAssignments(projectId, assignments = [], tenantId) {
  if (!isSupabaseConfigured || !supabase) {
    return { created: [], skipped: [] };
  }

  const parsedProjectId = Number.parseInt(String(projectId), 10);
  if (!Number.isInteger(parsedProjectId) || parsedProjectId <= 0) {
    throw new Error("Project id is required.");
  }

  if (!Array.isArray(assignments) || assignments.length === 0) {
    return { created: [], skipped: [] };
  }

  const seen = new Set();
  const normalizedAssignments = assignments
    .map((entry) => {
      const memberId = Number.parseInt(String(entry?.member_id), 10);
      if (!Number.isInteger(memberId) || memberId <= 0) {
        return null;
      }
      if (seen.has(memberId)) {
        return null;
      }
      seen.add(memberId);
      return {
        member_id: memberId,
        role: normalizeOptional(entry?.role) || "Member",
        term_start: normalizeOptional(entry?.term_start) || new Date().toISOString().slice(0, 10),
      };
    })
    .filter(Boolean);

  if (!normalizedAssignments.length) {
    return { created: [], skipped: [] };
  }

  const created = [];
  const skipped = [];
  const errors = [];

  for (const assignment of normalizedAssignments) {
    let existsQuery = supabase
      .from("iga_committee_members")
      .select("id")
      .eq("project_id", parsedProjectId)
      .eq("member_id", assignment.member_id)
      .maybeSingle();
    existsQuery = applyTenantFilter(existsQuery, tenantId);
    const { data: existing, error: existsError } = await existsQuery;

    if (existsError) {
      errors.push(existsError);
      continue;
    }

    if (existing) {
      skipped.push({ member_id: assignment.member_id, reason: "already_assigned" });
      continue;
    }

    const { data, error } = await supabase
      .from("iga_committee_members")
      .insert({
        project_id: parsedProjectId,
        member_id: assignment.member_id,
        role: assignment.role,
        term_start: assignment.term_start,
        tenant_id: tenantId ?? null,
      })
      .select()
      .single();

    if (error) {
      errors.push(error);
      continue;
    }

    created.push(data);
  }

  if (errors.length) {
    const allPermissionErrors = errors.every((error) => String(error?.code || "") === "42501");
    const combinedError = new Error(
      allPermissionErrors
        ? "Some selected members could not be assigned due to permission limits."
        : "Failed to assign some project members."
    );
    combinedError.details = { created, skipped, errors };
    throw combinedError;
  }

  return { created, skipped };
}

export async function createMemberAdmin(payload) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase not configured");
  }

  const passwordHash = normalizeOptional(payload.password_hash);
  const insertPayload = {
    name: normalizeOptional(payload.name),
    email: normalizeOptional(payload.email),
    phone_number: normalizeOptional(payload.phone_number),
    role: normalizeOptional(payload.role) || "member",
    status: normalizeOptional(payload.status) || "active",
    join_date: normalizeOptional(payload.join_date) || new Date().toISOString().slice(0, 10),
    // For admin-created members, explicitly set auth_id to null (not authenticated yet)
    // The trigger members_self_write_guard() allows admins to create members with null auth_id
    auth_id: null,
    password_hash: passwordHash || "admin_created",
    gender: normalizeOptional(payload.gender),
    national_id: normalizeOptional(payload.national_id),
    occupation: normalizeOptional(payload.occupation),
    address: normalizeOptional(payload.address),
    county: normalizeOptional(payload.county),
    sub_county: normalizeOptional(payload.sub_county),
    avatar_url: normalizeOptional(payload.avatar_url),
    bio: normalizeOptional(payload.bio),
    emergency_contact_name: normalizeOptional(payload.emergency_contact_name),
    emergency_contact_phone: normalizeOptional(payload.emergency_contact_phone),
    emergency_contact_relationship: normalizeOptional(payload.emergency_contact_relationship),
  };

  const insertVariants = [
    insertPayload,
    { ...insertPayload, bio: undefined },
    { ...insertPayload, avatar_url: undefined },
    { ...insertPayload, bio: undefined, avatar_url: undefined },
  ];
  let data = null;
  let error = null;
  for (const variant of insertVariants) {
    const normalizedVariant = Object.fromEntries(
      Object.entries(variant).filter(([, value]) => value !== undefined)
    );
    const result = await supabase.from("members").insert(normalizedVariant).select().single();
    data = result.data;
    error = result.error;
    if (!error) {
      break;
    }
    const isRecoverableMissingColumn =
      isMissingColumnError(error, "bio") || isMissingColumnError(error, "avatar_url");
    if (!isRecoverableMissingColumn) {
      console.error("createMemberAdmin error:", error);
      break;
    }
  }

  if (error) {
    throw error;
  }

  return data;
}

export async function updateMemberAdmin(memberId, payload) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase not configured");
  }

  const updatePayload = {
    name: normalizeOptional(payload.name),
    email: normalizeOptional(payload.email),
    phone_number: normalizeOptional(payload.phone_number),
    role: normalizeOptional(payload.role),
    status: normalizeOptional(payload.status),
    join_date: normalizeOptional(payload.join_date),
    auth_id: normalizeOptional(payload.auth_id),
    gender: normalizeOptional(payload.gender),
    national_id: normalizeOptional(payload.national_id),
    occupation: normalizeOptional(payload.occupation),
    address: normalizeOptional(payload.address),
    county: normalizeOptional(payload.county),
    sub_county: normalizeOptional(payload.sub_county),
    avatar_url: normalizeOptional(payload.avatar_url),
    bio: normalizeOptional(payload.bio),
    emergency_contact_name: normalizeOptional(payload.emergency_contact_name),
    emergency_contact_phone: normalizeOptional(payload.emergency_contact_phone),
    emergency_contact_relationship: normalizeOptional(payload.emergency_contact_relationship),
  };

  const updateVariants = [
    updatePayload,
    { ...updatePayload, bio: undefined },
    { ...updatePayload, avatar_url: undefined },
    { ...updatePayload, bio: undefined, avatar_url: undefined },
  ];
  let data = null;
  let error = null;
  for (const variant of updateVariants) {
    const normalizedVariant = Object.fromEntries(
      Object.entries(variant).filter(([, value]) => value !== undefined)
    );
    const result = await supabase
      .from("members")
      .update(normalizedVariant)
      .eq("id", memberId)
      .select()
      .single();
    data = result.data;
    error = result.error;
    if (!error) {
      break;
    }
    const isRecoverableMissingColumn =
      isMissingColumnError(error, "bio") || isMissingColumnError(error, "avatar_url");
    if (!isRecoverableMissingColumn) {
      break;
    }
  }

  if (error) {
    throw error;
  }

  return data;
}

export async function updateTenantMembershipAdmin(membershipId, payload = {}) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase not configured");
  }

  if (!membershipId) {
    throw new Error("Tenant membership is required.");
  }

  const updatePayload = {};
  if (Object.prototype.hasOwnProperty.call(payload, "role")) {
    const normalizedRole = normalizeOptional(payload?.role);
    if (!normalizedRole) {
      throw new Error("Membership role is required.");
    }
    updatePayload.role = normalizedRole;
  }
  if (Object.prototype.hasOwnProperty.call(payload, "status")) {
    const normalizedStatus = normalizeOptional(payload?.status);
    if (!normalizedStatus) {
      throw new Error("Membership status is required.");
    }
    updatePayload.status = normalizedStatus;
  }
  if (!Object.keys(updatePayload).length) {
    throw new Error("No membership changes were provided.");
  }
  updatePayload.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("tenant_members")
    .update(updatePayload)
    .eq("id", membershipId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function deleteTenantMembershipAdmin(membershipId) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase not configured");
  }

  if (!membershipId) {
    throw new Error("Tenant membership is required.");
  }

  const { error } = await supabase.from("tenant_members").delete().eq("id", membershipId);

  if (error) {
    throw error;
  }

  return true;
}

export async function getProjectMembersAdmin(projectId, tenantId) {
  if (!projectId) {
    return [];
  }

  const mockMembers = [
    {
      id: "mock-project-member-1",
      project_id: projectId,
      member_id: 1,
      role: "Member",
      term_start: "2026-01-05",
      members: {
        id: 1,
        name: "Mary Achieng",
        email: "mary@example.com",
        phone_number: "+254 700 000 001",
        role: "member",
      },
    },
  ];

  if (!isSupabaseConfigured || !supabase) {
    return mockMembers;
  }

  let query = supabase
    .from("iga_committee_members")
    .select("id, project_id, member_id, role, term_start, members (id, name, email, phone_number, role, status)")
    .eq("project_id", projectId)
    .order("term_start", { ascending: false });
  query = applyTenantFilter(query, tenantId);
  const { data, error } = await query;

  if (!error) {
    return data || [];
  }

  let membershipQuery = supabase
    .from("iga_committee_members")
    .select("id, project_id, member_id, role, term_start")
    .eq("project_id", projectId);
  membershipQuery = applyTenantFilter(membershipQuery, tenantId);
  const { data: membership, error: membershipError } = await membershipQuery;

  if (membershipError) {
    throw membershipError;
  }

  const memberIds = (membership || []).map((item) => item.member_id).filter(Boolean);
  if (!memberIds.length) {
    return membership || [];
  }

  const { data: memberData, error: memberError } = await supabase
    .from("members")
    .select("id, name, email, phone_number, role, status")
    .in("id", memberIds);

  if (memberError) {
    return membership || [];
  }

  const memberMap = new Map((memberData || []).map((member) => [member.id, member]));
  return (membership || []).map((item) => ({
    ...item,
    members: memberMap.get(item.member_id) || null,
  }));
}

export async function addProjectMemberAdmin({ projectId, memberId, role, term_start, tenantId }) {
  if (!projectId || !memberId) {
    throw new Error("Project and member are required.");
  }

  if (!isSupabaseConfigured || !supabase) {
    return {
      id: `mock-project-member-${Date.now()}`,
      project_id: projectId,
      member_id: memberId,
      role: role || "Member",
      term_start: term_start || new Date().toISOString().slice(0, 10),
    };
  }

  let existingQuery = supabase
    .from("iga_committee_members")
    .select("id")
    .eq("project_id", projectId)
    .eq("member_id", memberId)
    .maybeSingle();
  existingQuery = applyTenantFilter(existingQuery, tenantId);
  const { data: existing } = await existingQuery;

  if (existing) {
    throw new Error("Member is already assigned to this project.");
  }

  const { data, error } = await supabase
    .from("iga_committee_members")
    .insert({
      project_id: projectId,
      member_id: memberId,
      role: role || "Member",
      term_start: term_start || new Date().toISOString().slice(0, 10),
      tenant_id: tenantId ?? null,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function removeProjectMemberAdmin(projectMemberId, tenantId) {
  if (!projectMemberId) {
    return false;
  }

  if (!isSupabaseConfigured || !supabase) {
    return true;
  }

  let query = supabase
    .from("iga_committee_members")
    .delete()
    .eq("id", projectMemberId);
  query = applyTenantFilter(query, tenantId);
  const { error } = await query;

  if (error) {
    throw error;
  }

  return true;
}

export async function updateProjectMemberAdmin(projectMemberId, payload, tenantId) {
  if (!projectMemberId) {
    throw new Error("Project member id is required.");
  }

  if (!isSupabaseConfigured || !supabase) {
    return {
      id: projectMemberId,
      ...payload,
    };
  }

  const updatePayload = {
    role: normalizeOptional(payload.role),
    term_start: normalizeOptional(payload.term_start),
  };

  let query = supabase
    .from("iga_committee_members")
    .update(updatePayload)
    .eq("id", projectMemberId);
  query = applyTenantFilter(query, tenantId);
  const { data, error } = await query.select().single();

  if (error) {
    throw error;
  }

  return data;
}

export async function getMemberInvites(tenantId) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase not configured");
  }

  let query = supabase
    .from("member_invites")
    .select("*")
    .order("created_at", { ascending: false });
  query = applyTenantFilter(query, tenantId);
  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return data || [];
}

export async function createMemberInvite(payload) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase not configured");
  }

  const code = generateInviteCode();
  const codeHash = await hashInviteCode(code);
  const codePrefix = code.replace(/-/g, "").slice(0, 8);

  const insertPayload = {
    email: normalizeOptional(payload.email),
    phone_number: normalizeOptional(payload.phone_number),
    role: normalizeOptional(payload.role) || "member",
    status: "pending",
    code_hash: codeHash,
    code_prefix: codePrefix,
    created_by: payload.created_by || null,
    tenant_id: normalizeOptional(payload.tenant_id),
    expires_at: payload.expires_at || null,
    notes: normalizeOptional(payload.notes),
  };

  const { data, error } = await supabase
    .from("member_invites")
    .insert(insertPayload)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return { invite: data, code };
}

export async function verifyMemberInvite(code) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase not configured");
  }

  const trimmed = String(code || "").trim();
  if (!trimmed) {
    throw new Error("Invite code is required.");
  }

  const { data, error } = await supabase.rpc("verify_member_invite", {
    code: trimmed,
  });

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Invalid invite code.");
  }

  return data;
}

export async function markInviteUsed(inviteId) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase not configured");
  }

  if (!inviteId) {
    return null;
  }

  const { data, error } = await supabase
    .from("member_invites")
    .update({ status: "used" })
    .eq("id", inviteId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function revokeMemberInvite(inviteId) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase not configured");
  }

  const { data, error } = await supabase
    .from("member_invites")
    .update({ status: "revoked" })
    .eq("id", inviteId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

// ─── Magic Link Invites ───────────────────────────────────────────────────

function generateSimpleInviteNumber() {
  // Generate a random 7-digit number like "8374629"
  return String(Math.floor(Math.random() * 10000000)).padStart(7, "0");
}

function normalizeInviteProjectScope(scope) {
  const normalized = String(scope || "").trim().toLowerCase();
  if (normalized === "all" || normalized === "selected" || normalized === "none") {
    return normalized;
  }
  return "none";
}

function normalizeInviteProjectIds(projectIds) {
  if (!Array.isArray(projectIds)) {
    return [];
  }
  return Array.from(
    new Set(
      projectIds
        .map((projectId) => Number.parseInt(String(projectId || ""), 10))
        .filter((projectId) => Number.isInteger(projectId) && projectId > 0)
    )
  );
}

export async function createMagicLinkInvite(payload) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase not configured");
  }

  const inviteNumber = generateSimpleInviteNumber();
  const expiresAt = payload.expires_at || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // Default 7 days
  const projectAccessScope = normalizeInviteProjectScope(payload.project_access_scope);
  const projectIds =
    projectAccessScope === "selected" ? normalizeInviteProjectIds(payload.project_ids) : [];

  const insertPayload = {
    email: normalizeOptional(payload.email),
    phone_number: normalizeOptional(payload.phone_number),
    role: normalizeOptional(payload.role) || "member",
    status: "pending",
    invite_number: inviteNumber,
    created_by: payload.created_by || null,
    tenant_id: normalizeOptional(payload.tenant_id),
    expires_at: expiresAt,
    notes: normalizeOptional(payload.notes),
    project_access_scope: projectAccessScope,
    project_ids: projectIds,
  };

  const { data, error } = await supabase
    .from("magic_link_invites")
    .insert(insertPayload)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return { invite: data, inviteNumber };
}

export async function getProjectMagicLinkInvites(projectId) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase not configured");
  }

  const parsedProjectId = Number.parseInt(String(projectId || ""), 10);
  if (!Number.isInteger(parsedProjectId) || parsedProjectId <= 0) {
    return [];
  }

  const { data, error } = await supabase.rpc("get_project_magic_link_invites", {
    p_project_id: parsedProjectId,
  });

  if (error) {
    throw error;
  }

  return Array.isArray(data) ? data : [];
}

export async function createProjectMagicLinkInvite(payload) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase not configured");
  }

  const parsedProjectId = Number.parseInt(String(payload?.project_id || payload?.projectId || ""), 10);
  if (!Number.isInteger(parsedProjectId) || parsedProjectId <= 0) {
    throw new Error("Valid project id is required.");
  }

  const email = normalizeOptional(payload?.email);
  if (!email) {
    throw new Error("Invite email is required.");
  }

  const role = normalizeOptional(payload?.role) || "member";

  const { data, error } = await supabase.rpc("create_project_magic_link_invite", {
    p_project_id: parsedProjectId,
    p_email: email,
    p_role: role,
    p_phone_number: normalizeOptional(payload?.phone_number),
    p_notes: normalizeOptional(payload?.notes),
  });

  if (error) {
    throw error;
  }

  const invite = Array.isArray(data) ? data[0] || null : null;
  if (!invite) {
    throw new Error("Failed to create invite.");
  }

  return {
    invite,
    inviteNumber: invite.invite_number || null,
  };
}

export async function getTenantMagicLinkInvites(tenantId, options = {}) {
  if (!shouldUseSupabase()) {
    return [];
  }

  if (!tenantId) {
    return [];
  }

  const limit = Number.parseInt(String(options?.limit || ""), 10);
  let query = supabase
    .from("magic_link_invites")
    .select(
      "id, tenant_id, email, phone_number, role, status, invite_number, created_at, sent_at, expires_at, used_at, used_by, project_access_scope, project_ids, notes"
    )
    .order("created_at", { ascending: false });
  query = applyTenantFilter(query, tenantId);
  if (Number.isInteger(limit) && limit > 0) {
    query = query.limit(limit);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return Array.isArray(data) ? data : [];
}

export async function resendMagicLinkInvite(inviteId, options = {}) {
  if (!shouldUseSupabase()) {
    throw new Error("Supabase not configured");
  }

  const safeInviteId = String(inviteId || "").trim();
  if (!safeInviteId) {
    throw new Error("Invite id is required.");
  }

  const expiresInDays = Number.parseInt(String(options?.expiresInDays || ""), 10);
  const validDays = Number.isInteger(expiresInDays) && expiresInDays > 0 ? expiresInDays : 7;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + validDays * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("magic_link_invites")
    .update({
      status: "pending",
      sent_at: now.toISOString(),
      expires_at: expiresAt,
    })
    .eq("id", safeInviteId)
    .neq("status", "used")
    .select(
      "id, tenant_id, email, phone_number, role, status, invite_number, created_at, sent_at, expires_at, used_at, used_by, project_access_scope, project_ids, notes"
    )
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Invite could not be reissued.");
  }

  return data;
}

export async function cancelMagicLinkInvite(inviteId) {
  if (!shouldUseSupabase()) {
    throw new Error("Supabase not configured");
  }

  const safeInviteId = String(inviteId || "").trim();
  if (!safeInviteId) {
    throw new Error("Invite id is required.");
  }

  const { data, error } = await supabase
    .from("magic_link_invites")
    .update({
      status: "revoked",
    })
    .eq("id", safeInviteId)
    .neq("status", "used")
    .select(
      "id, tenant_id, email, phone_number, role, status, invite_number, created_at, sent_at, expires_at, used_at, used_by, project_access_scope, project_ids, notes"
    )
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Invite could not be canceled.");
  }

  return data;
}

export async function getTenantMemberAuditLog(tenantId, options = {}) {
  if (!shouldUseSupabase()) {
    return [];
  }

  if (!tenantId) {
    return [];
  }

  const limit = Number.parseInt(String(options?.limit || ""), 10);
  let query = supabase
    .from("tenant_member_audit_log")
    .select(
      "id, tenant_id, tenant_membership_id, member_id, member_name, actor_member_id, actor_name, action, previous_role, next_role, previous_status, next_status, note, metadata, occurred_at, member:members!tenant_member_audit_log_member_id_fkey(id, name, email), actor:members!tenant_member_audit_log_actor_member_id_fkey(id, name, email)"
    )
    .order("occurred_at", { ascending: false });

  query = applyTenantFilter(query, tenantId);
  if (Number.isInteger(limit) && limit > 0) {
    query = query.limit(limit);
  }

  const { data, error } = await query;
  if (error) {
    if (isMissingRelationError(error, "tenant_member_audit_log")) {
      return [];
    }
    throw error;
  }

  return (Array.isArray(data) ? data : []).map((row) => ({
    id: row?.id || null,
    tenant_id: row?.tenant_id || null,
    tenant_membership_id: row?.tenant_membership_id || null,
    member_id: row?.member_id || row?.member?.id || null,
    member_name: normalizeOptional(row?.member_name) || normalizeOptional(row?.member?.name) || "Member",
    actor_member_id: row?.actor_member_id || row?.actor?.id || null,
    actor_name: normalizeOptional(row?.actor_name) || normalizeOptional(row?.actor?.name) || "System",
    action: normalizeOptional(row?.action) || "updated",
    previous_role: normalizeOptional(row?.previous_role),
    next_role: normalizeOptional(row?.next_role),
    previous_status: normalizeOptional(row?.previous_status),
    next_status: normalizeOptional(row?.next_status),
    note: normalizeOptional(row?.note) || "Membership updated.",
    metadata: row?.metadata || {},
    occurred_at: row?.occurred_at || null,
  }));
}

export async function getProjectMemberAssignmentsSummary(tenantId, memberId = null) {
  if (!shouldUseSupabase()) {
    return [];
  }

  let query = supabase
    .from("iga_committee_members")
    .select("id, project_id, member_id, role, term_start")
    .order("project_id", { ascending: true });
  query = applyTenantFilter(query, tenantId);

  const parsedMemberId = Number.parseInt(String(memberId || ""), 10);
  if (Number.isInteger(parsedMemberId) && parsedMemberId > 0) {
    query = query.eq("member_id", parsedMemberId);
  }

  const { data: assignmentRows, error: assignmentError } = await query;
  if (assignmentError) {
    throw assignmentError;
  }

  const rows = Array.isArray(assignmentRows) ? assignmentRows : [];
  if (!rows.length) {
    return [];
  }

  const projectIds = Array.from(
    new Set(
      rows
        .map((row) => Number.parseInt(String(row?.project_id || ""), 10))
        .filter((projectId) => Number.isInteger(projectId) && projectId > 0)
    )
  );

  const projectNameById = new Map();
  if (projectIds.length) {
    let projectsQuery = supabase
      .from("iga_projects")
      .select("id, name, module_key, status")
      .in("id", projectIds);
    projectsQuery = applyTenantFilter(projectsQuery, tenantId);
    const { data: projectRows, error: projectsError } = await projectsQuery;
    if (projectsError) {
      throw projectsError;
    }
    (projectRows || []).forEach((project) => {
      const projectId = Number.parseInt(String(project?.id || ""), 10);
      if (!Number.isInteger(projectId) || projectId <= 0) return;
      projectNameById.set(projectId, {
        id: projectId,
        name: project?.name || `Project ${projectId}`,
        module_key: project?.module_key || "",
        status: project?.status || "",
      });
    });
  }

  return rows.map((row) => {
    const parsedProjectId = Number.parseInt(String(row?.project_id || ""), 10);
    const parsedMemberRef = Number.parseInt(String(row?.member_id || ""), 10);
    const projectInfo = projectNameById.get(parsedProjectId) || null;
    return {
      id: row?.id,
      project_id: parsedProjectId,
      member_id: parsedMemberRef,
      role: row?.role || "Member",
      term_start: row?.term_start || null,
      project_name: projectInfo?.name || (Number.isInteger(parsedProjectId) ? `Project ${parsedProjectId}` : "Project"),
      project_module_key: projectInfo?.module_key || "",
      project_status: projectInfo?.status || "",
    };
  });
}

export async function verifyMagicLinkInvite(inviteNumber) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase not configured");
  }

  const trimmed = String(inviteNumber || "").trim();
  if (!trimmed) {
    throw new Error("Invite number is required.");
  }

  const { data, error } = await supabase.rpc("verify_magic_link_invite", {
    p_invite_number: trimmed,
  });

  if (error) {
    throw error;
  }

  if (!data || data.length === 0) {
    throw new Error("Invalid or expired invite number.");
  }

  return data[0];
}

export async function markMagicLinkInviteUsed(inviteId, memberId) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase not configured");
  }

  if (!inviteId || !memberId) {
    return null;
  }

  const { data, error } = await supabase.rpc("mark_magic_link_invite_used", {
    p_invite_id: inviteId,
    p_member_id: memberId,
  });

  if (error) {
    throw error;
  }

  return data?.[0] || null;
}

export async function applyMagicLinkInviteProjectAccess(inviteId, memberId) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase not configured");
  }

  if (!inviteId || !memberId) {
    return [];
  }

  const { data, error } = await supabase.rpc("apply_magic_link_invite_project_access", {
    p_invite_id: inviteId,
    p_member_id: memberId,
  });

  if (error) {
    throw error;
  }

  return Array.isArray(data) ? data : [];
}

export async function getWelfareAccounts(tenantId) {
  if (!isSupabaseConfigured || !supabase) {
    return [];
  }

  let query = supabase
    .from("welfare_accounts")
    .select("id, name, description")
    .order("name", { ascending: true });
  query = applyTenantFilter(query, tenantId);
  const { data, error } = await query;

  if (error) {
    console.error("Error fetching welfare accounts:", error);
    return [];
  }

  return data || [];
}

export async function getWelfareCycles(tenantId) {
  if (!isSupabaseConfigured || !supabase) {
    return [];
  }

  let query = supabase
    .from("welfare_cycles")
    .select("id, cycle_number, start_date, end_date")
    .order("cycle_number", { ascending: true });
  query = applyTenantFilter(query, tenantId);
  const { data, error } = await query;

  if (error) {
    console.error("Error fetching welfare cycles:", error);
    return [];
  }

  return data || [];
}

export async function getWelfareTransactionsAdmin(tenantId) {
  if (!isSupabaseConfigured || !supabase) {
    return [];
  }

  let query = supabase
    .from("welfare_transactions")
    .select(
      "id, welfare_account_id, cycle_id, member_id, amount, transaction_type, date, description, status, member:members(name)"
    )
    .order("date", { ascending: false });
  query = applyTenantFilter(query, tenantId);
  const { data, error } = await query;

  if (error) {
    console.error("Error fetching welfare transactions:", error);
    return [];
  }

  return data || [];
}

export async function createWelfareTransaction(payload, tenantId) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase not configured");
  }

  const insertPayload = {
    welfare_account_id: normalizeOptional(payload.welfare_account_id),
    cycle_id: normalizeOptional(payload.cycle_id),
    member_id: normalizeOptional(payload.member_id),
    amount: payload.amount,
    transaction_type: normalizeOptional(payload.transaction_type),
    date: payload.date,
    description: normalizeOptional(payload.description),
    status: normalizeOptional(payload.status) || "Completed",
    tenant_id: tenantId ?? null,
  };

  const { data, error } = await supabase
    .from("welfare_transactions")
    .insert(insertPayload)
    .select()
    .single();

  if (error) {
    console.error("Error creating welfare transaction:", error);
    throw new Error("Failed to create welfare transaction");
  }

  return data;
}

export async function updateWelfareTransaction(transactionId, payload, tenantId) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase not configured");
  }

  const updatePayload = {};

  if ("welfare_account_id" in payload)
    updatePayload.welfare_account_id = normalizeOptional(payload.welfare_account_id);
  if ("cycle_id" in payload) updatePayload.cycle_id = normalizeOptional(payload.cycle_id);
  if ("member_id" in payload) updatePayload.member_id = normalizeOptional(payload.member_id);
  if ("amount" in payload) updatePayload.amount = payload.amount;
  if ("transaction_type" in payload)
    updatePayload.transaction_type = normalizeOptional(payload.transaction_type);
  if ("date" in payload) updatePayload.date = payload.date;
  if ("description" in payload)
    updatePayload.description = normalizeOptional(payload.description);
  if ("status" in payload) updatePayload.status = normalizeOptional(payload.status);

  if (Object.keys(updatePayload).length === 0) {
    throw new Error("No fields to update");
  }

  let query = supabase
    .from("welfare_transactions")
    .update(updatePayload)
    .eq("id", transactionId);
  query = applyTenantFilter(query, tenantId);
  const { data, error } = await query.select().single();

  if (error) {
    console.error("Error updating welfare transaction:", error);
    throw new Error("Failed to update welfare transaction");
  }

  return data;
}

export async function deleteWelfareTransaction(transactionId, tenantId) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase not configured");
  }

  let query = supabase.from("welfare_transactions").delete().eq("id", transactionId);
  query = applyTenantFilter(query, tenantId);
  const { error } = await query;

  if (error) {
    console.error("Error deleting welfare transaction:", error);
    throw new Error("Failed to delete welfare transaction");
  }

  return true;
}

/**
 * Sign out the current user
 */
export async function signOut() {
  if (!isSupabaseConfigured || !supabase) return;

  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error("Error signing out:", error);
    throw error;
  }
}

/**
 * Get all visible projects for volunteer page
 */
export async function getPublicProjects(tenantId) {
  if (!isSupabaseConfigured || !supabase) {
    console.warn("Supabase not configured, returning mock data");
    return getMockProjects();
  }

  let query = supabase
    .from("iga_projects")
    .select(`
      id,
      code,
      name,
      tagline,
      short_description,
      description,
      location,
      skills_needed,
      time_commitment,
      team_size,
      timeline_status,
      status,
      is_recruiting,
      display_order,
      image_url
    `)
    .eq("is_visible", true)
    .order("display_order", { ascending: true });
  query = applyTenantFilter(query, tenantId);
  const { data, error } = await query;

  if (error) {
    console.error("Error fetching projects:", error);
    return getMockProjects();
  }

  // Fetch goals and roles for each project
  const projectsWithDetails = await Promise.all(
    (data || []).map(async (project) => {
      const [goalsRes, rolesRes] = await Promise.all([
        applyTenantFilter(
          supabase
            .from("project_goals")
            .select("id, goal")
            .eq("project_id", project.id)
            .order("display_order"),
          tenantId
        ),
        applyTenantFilter(
          supabase
            .from("project_volunteer_roles")
            .select("id, role_description")
            .eq("project_id", project.id)
            .order("display_order"),
          tenantId
        ),
      ]);

      return {
        ...project,
        goals: goalsRes.data || [],
        volunteerRoles: rolesRes.data || [],
      };
    })
  );

  return projectsWithDetails;
}

/**
 * Get a single project by code
 */
export async function getProjectByCode(code, tenantId) {
  if (!isSupabaseConfigured || !supabase) {
    console.warn("Supabase not configured, returning mock data");
    const mockProjects = getMockProjects();
    return mockProjects.find((p) => p.code === code) || null;
  }

  let query = supabase
    .from("iga_projects")
    .select(`
      id,
      code,
      name,
      tagline,
      short_description,
      description,
      location,
      skills_needed,
      time_commitment,
      team_size,
      timeline_status,
      status,
      is_recruiting,
      image_url,
      objectives,
      expected_outcomes,
      beneficiaries
    `)
    .eq("code", code)
    .eq("is_visible", true)
    .single();
  query = applyTenantFilter(query, tenantId);
  const { data: project, error } = await query;

  if (error) {
    console.error("Error fetching project:", error);
    const mockProjects = getMockProjects();
    return mockProjects.find((p) => p.code === code) || null;
  }

  // Fetch all related data in parallel
  const [goalsRes, rolesRes, galleryRes, faqRes, activitiesRes, donationItemsRes] = await Promise.all([
    applyTenantFilter(
      supabase
        .from("project_goals")
        .select("id, goal")
        .eq("project_id", project.id)
        .order("display_order"),
      tenantId
    ),
    applyTenantFilter(
      supabase
        .from("project_volunteer_roles")
        .select("id, role_description")
        .eq("project_id", project.id)
        .order("display_order"),
      tenantId
    ),
    applyTenantFilter(
      supabase
        .from("project_gallery")
        .select("id, image_url, caption")
        .eq("project_id", project.id)
        .order("display_order"),
      tenantId
    ),
    applyTenantFilter(
      supabase
        .from("project_faq")
        .select("id, question, answer")
        .eq("project_id", project.id)
        .order("display_order"),
      tenantId
    ),
    applyTenantFilter(
      supabase
        .from("project_activities")
        .select("id, title, description, icon")
        .eq("project_id", project.id)
        .order("display_order"),
      tenantId
    ),
    applyTenantFilter(
      supabase
        .from("project_donation_items")
        .select("id, item, description, estimated_cost")
        .eq("project_id", project.id)
        .order("display_order"),
      tenantId
    ),
  ]);

  return {
    ...project,
    goals: goalsRes.data || [],
    volunteerRoles: rolesRes.data || [],
    gallery: galleryRes.data || [],
    faq: faqRes.data || [],
    activities: activitiesRes.data || [],
    donationItems: donationItemsRes.data || [],
  };
}

/**
 * Mock projects data for development without Supabase
 */
function getMockProjects() {
  return [
    {
      id: 1,
      code: "JPP",
      name: "Poultry Incubation Initiative",
      tagline: "Sustainable poultry production & food security",
      short_description: "Sustainable poultry production & food security",
      description:
        "The Jongol Poultry Project (JPP) is our flagship agricultural initiative focused on sustainable poultry production. We incubate and raise layers and broilers, providing eggs and meat to local markets while creating employment opportunities for community members.",
      location: "Kosele, Homa Bay County",
      skills_needed: ["Farm hands", "Record keeping", "Marketing", "Poultry health"],
      time_commitment: "Flexible, few hours per week",
      team_size: "10+ active volunteers",
      timeline_status: "Ongoing – join anytime",
      status: "active",
      is_recruiting: true,
      display_order: 1,
      image_url: null,
      goals: [
        { id: 1, goal: "Produce 1,000+ eggs weekly for local distribution" },
        { id: 2, goal: "Train 50+ community members in poultry management" },
        { id: 3, goal: "Establish a sustainable feed production system" },
        { id: 4, goal: "Create income opportunities for youth and women" },
      ],
      volunteerRoles: [
        { id: 1, role_description: "Help with daily feeding and egg collection" },
        { id: 2, role_description: "Assist with record keeping and inventory" },
        { id: 3, role_description: "Support marketing and sales activities" },
        { id: 4, role_description: "Contribute technical expertise in poultry health" },
      ],
    },
    {
      id: 2,
      code: "JGF",
      name: "Groundnut Foods",
      tagline: "Value-addition agribusiness & nutrition",
      short_description: "Value-addition agribusiness & nutrition",
      description:
        "Jongol Groundnut Foods (JGF) is our value-addition agribusiness project transforming locally grown groundnuts into nutritious food products. We produce peanut butter, roasted nuts, and other groundnut-based products for local and regional markets.",
      location: "Kosele, Homa Bay County",
      skills_needed: ["Processing", "Packaging", "Distribution", "Food safety"],
      time_commitment: "Project-based involvement",
      team_size: "Growing team",
      timeline_status: "Development phase – launching soon",
      status: "planning",
      is_recruiting: true,
      display_order: 2,
      image_url: null,
      goals: [
        { id: 5, goal: "Process 500kg of groundnuts monthly" },
        { id: 6, goal: "Develop 5 unique groundnut-based products" },
        { id: 7, goal: "Partner with 20+ local farmers for sourcing" },
        { id: 8, goal: "Establish distribution channels across the county" },
      ],
      volunteerRoles: [
        { id: 5, role_description: "Assist with product processing and packaging" },
        { id: 6, role_description: "Help develop marketing materials and branding" },
        { id: 7, role_description: "Support distribution and sales efforts" },
        { id: 8, role_description: "Contribute expertise in food safety and quality" },
      ],
    },
  ];
}

// ===================================
// TENANTS (MULTI-TENANT SAAS)
// ===================================

const normalizeTenantWorkspaceName = (value) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ");

const buildTenantError = (message, code) => {
  const error = new Error(message);
  if (code) {
    error.code = code;
  }
  return error;
};

const isTenantNameUniqueViolation = (error) => {
  if (String(error?.code || "") !== "23505") return false;
  const payload = `${error?.message || ""} ${error?.details || ""}`.toLowerCase();
  return payload.includes("tenants_name_normalized_unique_idx");
};

const isTenantSlugUniqueViolation = (error) => {
  if (String(error?.code || "") !== "23505") return false;
  const payload = `${error?.message || ""} ${error?.details || ""}`.toLowerCase();
  return payload.includes("tenants_slug_key");
};

export async function createTenant(payload) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase not configured");
  }

  const name = normalizeOptional(payload?.name);
  const slug = normalizeOptional(payload?.slug);

  if (!name || !slug) {
    throw new Error("Tenant name and slug are required");
  }

  const insertPayload = {
    name: normalizeTenantWorkspaceName(name),
    slug: String(slug).toLowerCase(),
    currency_code: normalizeCurrencyCode(payload?.currency_code),
    tagline: normalizeOptional(payload?.tagline),
    contact_email: normalizeOptional(payload?.contact_email),
    contact_phone: normalizeOptional(payload?.contact_phone),
    location: normalizeOptional(payload?.location),
    logo_url: normalizeOptional(payload?.logo_url),
    site_data: payload?.site_data ?? null,
    is_public: payload?.is_public ?? true,
  };

  const { data, error } = await supabase
    .from("tenants")
    .insert(insertPayload)
    .select()
    .single();

  if (error) {
    if (isTenantNameUniqueViolation(error)) {
      throw buildTenantError(
        "That workspace/company name is already in use. Please choose another name.",
        "TENANT_NAME_TAKEN"
      );
    }
    if (isTenantSlugUniqueViolation(error)) {
      throw buildTenantError(
        "That workspace URL name is already in use. Please choose another workspace name.",
        "TENANT_SLUG_TAKEN"
      );
    }
    if (String(error?.code || "") === "23514") {
      throw buildTenantError(
        "Workspace name cannot be blank.",
        "TENANT_NAME_INVALID"
      );
    }
    throw error;
  }

  return data;
}

const normalizeWorkspaceLookupValue = (value) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ");

const workspaceLookupToSlug = (value) =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export async function findInviteSignupTenants(workspaceName) {
  if (!isSupabaseConfigured || !supabase) {
    return [];
  }

  const normalizedWorkspace = normalizeWorkspaceLookupValue(workspaceName);
  if (!normalizedWorkspace) {
    return [];
  }

  const slugCandidate = workspaceLookupToSlug(normalizedWorkspace);
  const tenantSelect = "id, name, slug, created_at";

  const [slugResult, nameResult] = await Promise.all([
    slugCandidate
      ? supabase
          .from("tenants")
          .select(tenantSelect)
          .eq("slug", slugCandidate)
          .order("created_at", { ascending: false })
          .limit(5)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("tenants")
      .select(tenantSelect)
      .ilike("name", normalizedWorkspace)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const slugError = slugResult?.error || null;
  const nameError = nameResult?.error || null;
  if (slugError && nameError) {
    throw slugError;
  }

  const merged = new Map();
  (slugResult?.data || []).forEach((tenant) => {
    if (tenant?.id) {
      merged.set(String(tenant.id), tenant);
    }
  });
  (nameResult?.data || []).forEach((tenant) => {
    if (tenant?.id) {
      merged.set(String(tenant.id), tenant);
    }
  });

  if (merged.size > 0) {
    return Array.from(merged.values());
  }

  const safeWorkspacePattern = normalizedWorkspace.replace(/[%_]/g, "").trim();
  if (safeWorkspacePattern.length < 3) {
    return [];
  }

  const { data: fuzzyMatches, error: fuzzyError } = await supabase
    .from("tenants")
    .select(tenantSelect)
    .ilike("name", `%${safeWorkspacePattern}%`)
    .order("created_at", { ascending: false })
    .limit(5);

  if (fuzzyError) {
    throw fuzzyError;
  }

  return fuzzyMatches || [];
}

export async function getTenantBySlug(slug) {
  if (!isSupabaseConfigured || !supabase) {
    return null;
  }

  const cleanSlug = String(slug || "").trim().toLowerCase();
  if (!cleanSlug) {
    return null;
  }

  const { data, error } = await supabase
    .from("tenants")
    .select("*")
    .eq("slug", cleanSlug)
    .eq("is_public", true)
    .maybeSingle();

  if (error) {
    console.error("Error fetching tenant:", error);
    return null;
  }

  return data || null;
}

export async function getTenantByContactEmail(email) {
  if (!isSupabaseConfigured || !supabase) {
    return null;
  }

  const cleanEmail = String(email || "").trim().toLowerCase();
  if (!cleanEmail) {
    return null;
  }

  const { data, error } = await supabase
    .from("tenants")
    .select("*")
    .ilike("contact_email", cleanEmail)
    .eq("is_public", true)
    .maybeSingle();

  if (error) {
    console.error("Error fetching tenant by contact email:", error);
    return null;
  }

  return data || null;
}

export async function getTenantSiteTemplates() {
  if (!isSupabaseConfigured || !supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("tenant_site_templates")
    .select("key, label, description, data, is_active")
    .eq("is_active", true)
    .order("label", { ascending: true });

  if (error) {
    console.error("Error fetching tenant site templates:", error);
    return [];
  }

  return data || [];
}

export async function getTenantSiteTemplate(templateKey) {
  if (!isSupabaseConfigured || !supabase) {
    return null;
  }

  const cleanKey = String(templateKey || "").trim();
  if (!cleanKey) {
    return null;
  }

  const { data, error } = await supabase
    .from("tenant_site_templates")
    .select("key, data, is_active")
    .eq("key", cleanKey)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    console.error("Error fetching tenant site template:", error);
    return null;
  }

  return data?.data ?? null;
}

export async function getTenantById(tenantId) {
  if (!isSupabaseConfigured || !supabase) {
    return null;
  }

  if (!tenantId) {
    return null;
  }

  const { data, error } = await supabase
    .from("tenants")
    .select("*")
    .eq("id", tenantId)
    .maybeSingle();

  if (error) {
    console.error("Error fetching tenant:", error);
    return null;
  }

  return data || null;
}

export async function updateTenant(tenantId, payload) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase not configured");
  }

  if (!tenantId) {
    throw new Error("Tenant ID is required");
  }

  const updatePayload = {
    updated_at: new Date().toISOString(),
  };

  if (Object.prototype.hasOwnProperty.call(payload || {}, "name")) {
    updatePayload.name = normalizeOptional(payload?.name);
  }
  if (Object.prototype.hasOwnProperty.call(payload || {}, "tagline")) {
    updatePayload.tagline = normalizeOptional(payload?.tagline);
  }
  if (Object.prototype.hasOwnProperty.call(payload || {}, "currency_code")) {
    updatePayload.currency_code = normalizeCurrencyCode(payload?.currency_code);
  }
  if (Object.prototype.hasOwnProperty.call(payload || {}, "contact_email")) {
    updatePayload.contact_email = normalizeOptional(payload?.contact_email);
  }
  if (Object.prototype.hasOwnProperty.call(payload || {}, "contact_phone")) {
    updatePayload.contact_phone = normalizeOptional(payload?.contact_phone);
  }
  if (Object.prototype.hasOwnProperty.call(payload || {}, "location")) {
    updatePayload.location = normalizeOptional(payload?.location);
  }
  if (Object.prototype.hasOwnProperty.call(payload || {}, "logo_url")) {
    updatePayload.logo_url = normalizeOptional(payload?.logo_url);
  }
  if (Object.prototype.hasOwnProperty.call(payload || {}, "site_data")) {
    updatePayload.site_data = payload?.site_data ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(payload || {}, "is_public")) {
    updatePayload.is_public = payload?.is_public ?? true;
  }

  const { data, error } = await supabase
    .from("tenants")
    .update(updatePayload)
    .eq("id", tenantId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function createTenantMembership({ tenantId, memberId, role = "member" }) {
  if (!shouldUseSupabase()) {
    return null;
  }

  if (!tenantId || !memberId) {
    throw new Error("Tenant and member are required");
  }

  const insertPayload = {
    tenant_id: tenantId,
    member_id: memberId,
    role,
    status: "active",
  };

  const { data, error } = await supabase
    .from("tenant_members")
    .insert(insertPayload)
    .select()
    .single();

  if (error) {
    markSupabaseUnavailable(error);
    if (supabaseFallbackEnabled) {
      return null;
    }
    throw error;
  }

  return data;
}

export async function recoverMagicLinkTenantMembership(memberId, preferredSlug = null) {
  if (!shouldUseSupabase()) {
    return null;
  }

  if (!memberId) {
    return null;
  }

  const { data, error } = await supabase.rpc("recover_magic_link_tenant_membership", {
    p_member_id: memberId,
    p_preferred_slug: normalizeOptional(preferredSlug),
  });

  if (error) {
    markSupabaseUnavailable(error);
    throw error;
  }

  if (!Array.isArray(data) || data.length === 0) {
    return null;
  }

  return data[0] || null;
}

export async function getTenantMemberships(memberId) {
  if (!shouldUseSupabase()) {
    return [];
  }

  if (!memberId) {
    return [];
  }

  const { data, error } = await supabase
    .from("tenant_members")
    .select(
      `
      id,
      tenant_id,
      role,
      status,
      tenant:tenants (
        id,
        name,
        slug,
        tagline,
        logo_url,
        currency_code
      )
    `
    )
    .eq("member_id", memberId)
    .order("created_at", { ascending: true });

  if (error) {
    markSupabaseUnavailable(error);
    console.error("Error fetching tenant memberships:", error);
    return [];
  }

  return data || [];
}

export async function getTenantMembershipForSlug(memberId, slug) {
  if (!shouldUseSupabase()) {
    return null;
  }

  if (!memberId || !slug) {
    return null;
  }

  const cleanSlug = String(slug).trim().toLowerCase();
  if (!cleanSlug) {
    return null;
  }

  // First, get the tenant ID from the slug
  const { data: tenantData, error: tenantError } = await supabase
    .from("tenants")
    .select("id")
    .eq("slug", cleanSlug)
    .maybeSingle();

  if (tenantError) {
    markSupabaseUnavailable(tenantError);
    console.error("Error fetching tenant by slug:", tenantError);
    return null;
  }

  if (!tenantData) {
    return null;
  }

  // Now get the membership for this member and tenant
  const { data, error } = await supabase
    .from("tenant_members")
    .select(
      `
      id,
      role,
      status,
      tenant:tenants (
        id,
        name,
        slug,
        tagline,
        logo_url,
        currency_code,
        site_data,
        contact_email,
        contact_phone,
        location
      )
    `
    )
    .eq("member_id", memberId)
    .eq("tenant_id", tenantData.id)
    .maybeSingle();

  if (error) {
    markSupabaseUnavailable(error);
    console.error("Error fetching tenant membership:", error);
    return null;
  }

  return data || null;
}


/**
 * Get event subscribers for a tenant
 */
export async function getEventSubscribers(tenantId) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  if (!tenantId) {
    throw new Error("Tenant ID is required");
  }

  let query = supabase
    .from("newsletter_subscribers")
    .select("id, name, email, contact, type, status, created_at")
    .eq("tenant_id", tenantId)
    .eq("type", "event_attendee")
    .eq("status", "active")
    .order("name", { ascending: true });

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching event subscribers:", error);
    throw error;
  }

  return data || [];
}

/**
 * Create an event subscriber
 */
export async function createEventSubscriber(payload, tenantId) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  if (!tenantId) {
    throw new Error("Tenant ID is required");
  }

  const name = normalizeOptional(payload?.name);
  const email = normalizeOptional(payload?.email);
  const contact = normalizeOptional(payload?.contact);

  if (!name || !email) {
    throw new Error("Name and email are required for event subscribers");
  }

  const insertPayload = {
    tenant_id: tenantId,
    name,
    email,
    contact: contact || null,
    type: "event_attendee",
    status: "active",
  };

  const { data, error } = await supabase
    .from("newsletter_subscribers")
    .insert(insertPayload)
    .select()
    .single();

  if (error) {
    console.error("Error creating event subscriber:", error);
    throw error;
  }

  return data;
}
