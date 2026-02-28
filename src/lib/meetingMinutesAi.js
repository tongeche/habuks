import { EMPTY_MINUTES_DATA, createMinutesData } from "./meetingMinutes.js";
import { isSupabaseConfigured, supabase } from "./supabase.js";

const toText = (value) => String(value || "").trim();
const toJsonText = (value) => {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "{}";
  }
};

const firstConfiguredValue = (...values) =>
  values
    .flatMap((value) => String(value || "").split(","))
    .map((value) => toText(value))
    .find(Boolean) || "";

const OPENAI_BACKUP_ENDPOINT = toText(
  import.meta.env.VITE_MEETING_MINUTES_AI_ENDPOINT || import.meta.env.VITE_OPENAI_BACKUP_ENDPOINT
);

const OPENAI_BACKUP_FUNCTION = toText(
  import.meta.env.VITE_MEETING_MINUTES_AI_FUNCTION || import.meta.env.VITE_OPENAI_BACKUP_FUNCTION
);

const OPENAI_BROWSER_API_KEY = firstConfiguredValue(
  import.meta.env.VITE_OPENAI_API_KEYS,
  import.meta.env.VITE_OPENAI_API_KEY
);

const OPENAI_MODEL = toText(import.meta.env.VITE_OPENAI_MODEL) || "gpt-4.1-mini";

const createAgendaItem = (item = {}) => ({
  title: toText(item?.title),
  details: toText(item?.details || item?.discussion),
  resolutions: Array.isArray(item?.resolutions)
    ? item.resolutions.map((entry) => toText(entry)).filter(Boolean)
    : [toText(item?.resolution)].filter(Boolean),
});

const normalizeAgendaItems = (items = []) =>
  (Array.isArray(items) ? items : [])
    .map((item) => createAgendaItem(item))
    .filter(
      (item) =>
        item.title ||
        item.details ||
        (Array.isArray(item.resolutions) && item.resolutions.length)
    );

const normalizePeople = (rows = []) =>
  (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      name: toText(row?.name) || "Member",
      role: toText(row?.role),
      email: toText(row?.email),
      rsvp_status: toText(row?.rsvp_status || row?.rsvpStatus).toLowerCase(),
      attendance_status: toText(
        row?.attendance_status || row?.attendanceStatus
      ).toLowerCase(),
    }))
    .filter((row) => row.name);

const extractDraftPayload = (value) => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    if (value.draft && typeof value.draft === "object" && !Array.isArray(value.draft)) {
      return value.draft;
    }
    if (value.result && typeof value.result === "object" && !Array.isArray(value.result)) {
      return value.result;
    }
    if (value.data && typeof value.data === "object" && !Array.isArray(value.data)) {
      return value.data;
    }
    return value;
  }
  return {};
};

const normalizeDraftResponse = (value) => {
  const payload = extractDraftPayload(value);
  const minutesValue =
    payload.minutes_data || payload.minutesData || payload.minutes || payload.sections || {};
  const agendaValue = payload.agenda_items || payload.agendaItems || payload.items || [];

  return {
    provider: toText(value?.provider || payload?.provider),
    model: toText(value?.model || payload?.model),
    minutes_data: createMinutesData(minutesValue),
    agenda_items: normalizeAgendaItems(agendaValue),
  };
};

const buildRequestPayload = ({
  meeting = {},
  leadershipNames = {},
  agendaItems = [],
  presentRows = [],
  apologyRows = [],
  absentRows = [],
  currentMinutesData = {},
  fallbackMinutesData = {},
} = {}) => ({
  kind: "meeting_minutes_openai_backup",
  meeting: {
    id: meeting?.id ?? null,
    title: toText(meeting?.title),
    date: toText(meeting?.date),
    location: toText(meeting?.location),
    description: toText(meeting?.description),
    agenda_summary: toText(meeting?.agenda),
    start_at: toText(meeting?.start_at || meeting?.startAt),
    audience_scope: toText(meeting?.audience_scope || meeting?.audienceScope),
  },
  leadership: {
    chairperson: toText(leadershipNames?.chairperson),
    vice_chairperson: toText(leadershipNames?.viceChairperson),
    secretary: toText(leadershipNames?.secretary),
    treasurer: toText(leadershipNames?.treasurer),
  },
  attendance: {
    present: normalizePeople(presentRows),
    absent_with_apology: normalizePeople(apologyRows),
    absent_without_apology: normalizePeople(absentRows),
  },
  agenda_items: normalizeAgendaItems(agendaItems),
  current_minutes_data: createMinutesData(currentMinutesData),
  fallback_minutes_data: createMinutesData(fallbackMinutesData),
  output_contract: {
    minutes_data: EMPTY_MINUTES_DATA,
    agenda_items: [
      {
        title: "Agenda item title",
        details: "Formal discussion narrative for that agenda item.",
        resolutions: ["Resolution or action captured for the agenda item."],
      },
    ],
  },
});

const requestDraftFromEndpoint = async (payload) => {
  const response = await fetch(OPENAI_BACKUP_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    throw new Error(
      toText(data?.error || data?.message) ||
        `OpenAI backup request failed with status ${response.status}.`
    );
  }

  return data;
};

const requestDraftFromFunction = async (payload) => {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error("Supabase is not configured for OpenAI backup.");
  }

  const { data, error } = await supabase.functions.invoke(OPENAI_BACKUP_FUNCTION, {
    body: payload,
  });

  if (error) {
    throw new Error(toText(error.message) || "OpenAI backup request failed.");
  }

  return data;
};

const requestDraftFromOpenAiBrowser = async (payload) => {
  if (!OPENAI_BROWSER_API_KEY) {
    throw new Error("OpenAI browser key is not configured.");
  }

  if (!import.meta.env.DEV) {
    throw new Error("Direct browser OpenAI access is limited to development.");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_BROWSER_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      response_format: { type: "json_object" },
      temperature: 0.4,
      messages: [
        {
          role: "system",
          content:
            "You generate structured organization meeting minutes. Respond with valid JSON only. Return an object with keys minutes_data and agenda_items. minutes_data must contain preliminaries, previous_minutes {status, notes}, financial_matters {discussion, resolution}, next_meeting {date, note}, adjournment {time, note}. agenda_items must be an array of {title, details, resolutions:string[]}. Use a formal tone, preserve provided facts, do not invent names, dates, or attendance that are missing.",
        },
        {
          role: "user",
          content: [
            "Create or improve a formal meeting minutes draft from this context.",
            "",
            "Context JSON:",
            toJsonText(payload),
          ].join("\n"),
        },
      ],
    }),
  });

  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    throw new Error(
      toText(data?.error?.message || data?.message) ||
        `OpenAI browser request failed with status ${response.status}.`
    );
  }

  const content = toText(data?.choices?.[0]?.message?.content);
  if (!content) {
    throw new Error("OpenAI browser request returned an empty response.");
  }

  try {
    return JSON.parse(content);
  } catch {
    throw new Error("OpenAI browser response was not valid JSON.");
  }
};

export const isMeetingMinutesAiConfigured = () =>
  Boolean(OPENAI_BACKUP_ENDPOINT) ||
  Boolean(OPENAI_BACKUP_FUNCTION && supabase && isSupabaseConfigured) ||
  Boolean(import.meta.env.DEV && OPENAI_BROWSER_API_KEY);

export const enhanceMeetingMinutesDraftWithAi = async (options = {}) => {
  if (!isMeetingMinutesAiConfigured()) {
    throw new Error("OpenAI backup is not configured yet.");
  }

  const payload = buildRequestPayload(options);
  const response = OPENAI_BACKUP_ENDPOINT
    ? await requestDraftFromEndpoint(payload)
    : OPENAI_BACKUP_FUNCTION && supabase && isSupabaseConfigured
      ? await requestDraftFromFunction(payload)
      : await requestDraftFromOpenAiBrowser(payload);
  const normalized = normalizeDraftResponse(response);

  const hasMinutesContent = Object.values(normalized.minutes_data || {}).some((value) => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return Object.values(value).some((entry) => toText(entry));
    }
    return toText(value);
  });
  const hasAgendaContent = Array.isArray(normalized.agenda_items) && normalized.agenda_items.length > 0;

  if (!hasMinutesContent && !hasAgendaContent) {
    throw new Error("OpenAI backup returned no usable draft content.");
  }

  return normalized;
};
