const toObject = (value) => (value && typeof value === "object" && !Array.isArray(value) ? value : {});

const toText = (value) => String(value || "").trim();

const toOptionalPositiveInt = (value) => {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

export const ORGANIZATION_LEADERSHIP_ROLES = [
  { key: "chairperson_member_id", label: "Chairperson" },
  { key: "vice_chairperson_member_id", label: "Vice Chairperson" },
  { key: "secretary_member_id", label: "Secretary" },
  { key: "treasurer_member_id", label: "Treasurer" },
];

export const EMPTY_MINUTES_DATA = {
  preliminaries: "",
  previous_minutes: {
    status: "",
    notes: "",
  },
  financial_matters: {
    discussion: "",
    resolution: "",
  },
  next_meeting: {
    date: "",
    note: "",
  },
  adjournment: {
    time: "",
    note: "",
  },
};

const AGENDA_PRESET_GROUPS = [
  {
    label: "Governance",
    items: [
      {
        key: "previous_minutes",
        label: "Confirmation of previous minutes",
        title: "Confirmation of previous minutes",
        details:
          "The secretary reads the previous minutes and members confirm the record, note corrections, and agree on any outstanding follow-up items.",
        resolutions: [
          "Previous minutes were confirmed as a true record.",
          "Outstanding follow-up items were noted for tracking.",
        ],
      },
      {
        key: "leadership_updates",
        label: "Leadership and governance updates",
        title: "Leadership and governance updates",
        details:
          "The chairperson leads a review of governance actions, committee follow-up, and any policy or compliance matters affecting the organization.",
        resolutions: [
          "Governance actions were reviewed and assigned to responsible leaders.",
          "Any policy items requiring follow-up were scheduled for the next meeting.",
        ],
      },
      {
        key: "partnerships",
        label: "Partnership and donor engagement",
        title: "Partnership and donor engagement",
        details:
          "Members review partnership opportunities, external relationships, and documents required to strengthen donor or stakeholder confidence.",
        resolutions: [
          "Priority partner follow-ups were assigned.",
          "Required support documents will be prepared before the next engagement.",
        ],
      },
    ],
  },
  {
    label: "Finance",
    items: [
      {
        key: "financial_review",
        label: "Financial review",
        title: "Financial review",
        details:
          "The treasurer presents the current financial position, key expenses, planned spending, and any control concerns raised by the committee.",
        resolutions: [
          "Financial summary was received and adopted.",
          "Expense controls and approvals were reaffirmed.",
        ],
      },
      {
        key: "welfare_collections",
        label: "Welfare collections and arrears",
        title: "Welfare collections and arrears",
        details:
          "Members review welfare collections, arrears, and proposed recovery actions while balancing member support and accountability.",
        resolutions: [
          "Members in arrears will receive reminders before the next cycle close.",
          "Welfare status will be reviewed again at the next meeting.",
        ],
      },
      {
        key: "budget_planning",
        label: "Budget planning",
        title: "Budget planning",
        details:
          "The meeting reviews upcoming resource needs, expected income, and cost priorities for the next operating period.",
        resolutions: [
          "Priority budget items were approved for the next period.",
          "Leaders will refine the budget before implementation.",
        ],
      },
    ],
  },
  {
    label: "Operations",
    items: [
      {
        key: "project_performance",
        label: "Project performance review",
        title: "Project performance review",
        details:
          "Project leads report on delivery progress, operational blockers, and actions required to keep work on schedule.",
        resolutions: [
          "Project leads will submit action updates before the next meeting.",
          "Operational bottlenecks were assigned for immediate follow-up.",
        ],
      },
      {
        key: "member_engagement",
        label: "Member engagement and attendance",
        title: "Member engagement and attendance",
        details:
          "The meeting reviews member participation, communication gaps, and practical ways to improve attendance and accountability.",
        resolutions: [
          "Attendance expectations were restated to members.",
          "Communication reminders will be issued before future meetings.",
        ],
      },
      {
        key: "planning_next_steps",
        label: "Planning next steps",
        title: "Planning next steps",
        details:
          "Members agree on immediate next actions, responsibilities, timelines, and preparation points for the next meeting.",
        resolutions: [
          "Action owners and timelines were agreed by the meeting.",
          "A progress review will be tabled at the next meeting.",
        ],
      },
    ],
  },
];

export const MEETING_AGENDA_PRESET_OPTIONS = AGENDA_PRESET_GROUPS.flatMap((group) =>
  group.items.map((item) => ({
    ...item,
    group: group.label,
  }))
);

export const getOrganizationProfileData = (siteData) =>
  toObject(toObject(siteData).organization_profile);

export const getOrganizationLeadershipRoles = (siteData) => {
  const profile = getOrganizationProfileData(siteData);
  const rawRoles = toObject(profile.leadership_roles);
  return ORGANIZATION_LEADERSHIP_ROLES.reduce((result, role) => {
    result[role.key] = rawRoles[role.key] ?? null;
    return result;
  }, {});
};

export const buildSiteDataWithLeadershipRoles = (siteData, leadershipRoles = {}) => {
  const safeSiteData = toObject(siteData);
  const profile = getOrganizationProfileData(safeSiteData);
  const nextLeadershipRoles = ORGANIZATION_LEADERSHIP_ROLES.reduce((result, role) => {
    result[role.key] = toOptionalPositiveInt(leadershipRoles?.[role.key]);
    return result;
  }, {});

  return {
    ...safeSiteData,
    organization_profile: {
      ...profile,
      leadership_roles: nextLeadershipRoles,
    },
  };
};

export const buildAgendaItemFromPreset = (presetKey) => {
  const preset = MEETING_AGENDA_PRESET_OPTIONS.find((item) => item.key === presetKey) || null;
  if (!preset) return null;
  return {
    title: preset.title,
    details: preset.details,
    resolutions: Array.isArray(preset.resolutions) ? [...preset.resolutions] : [],
  };
};

const hasText = (value) => Boolean(toText(value));

const addOneMonth = (value) => {
  const parsed = Date.parse(String(value || ""));
  if (!Number.isFinite(parsed)) return "";
  const next = new Date(parsed);
  next.setMonth(next.getMonth() + 1);
  return next.toISOString().slice(0, 10);
};

export const createMinutesData = (value = {}) => ({
  preliminaries: toText(value?.preliminaries),
  previous_minutes: {
    status: toText(value?.previous_minutes?.status),
    notes: toText(value?.previous_minutes?.notes),
  },
  financial_matters: {
    discussion: toText(value?.financial_matters?.discussion),
    resolution: toText(value?.financial_matters?.resolution),
  },
  next_meeting: {
    date: toText(value?.next_meeting?.date),
    note: toText(value?.next_meeting?.note),
  },
  adjournment: {
    time: toText(value?.adjournment?.time),
    note: toText(value?.adjournment?.note),
  },
});

const buildFinancialDraft = (agendaItems = [], leadershipNames = {}) => {
  const hasFinanceAgenda = agendaItems.some((item) =>
    /(finance|financial|budget|welfare|collections|arrears|treasurer|cash)/i.test(toText(item?.title))
  );
  const treasurerName = toText(leadershipNames?.treasurer) || "the treasurer";
  if (!hasFinanceAgenda) {
    return {
      discussion:
        "Members noted the current financial position and agreed that any material expense updates should continue to be shared with the leadership team before the next meeting.",
      resolution:
        "Financial matters arising before the next meeting will be reviewed by the leadership team and tabled formally at the next sitting.",
    };
  }
  return {
    discussion: `${treasurerName} presented the latest financial position, highlighted key cost pressures, and invited members to review immediate control priorities before the next reporting cycle.`,
    resolution:
      "The meeting adopted the financial update and agreed that all priority expense or collection actions would be tracked before the next meeting.",
  };
};

export const buildMinutesDraftFromAgenda = ({
  meetingTitle = "",
  meetingDate = "",
  agendaItems = [],
  leadershipNames = {},
} = {}) => {
  const safeAgendaItems = Array.isArray(agendaItems) ? agendaItems : [];
  const chairpersonName = toText(leadershipNames?.chairperson) || "the chairperson";
  const secretaryName = toText(leadershipNames?.secretary) || "the secretary";
  const meetingLabel = toText(meetingTitle) || "the meeting";

  return {
    preliminaries: `${chairpersonName} called ${meetingLabel} to order, welcomed members present, confirmed quorum, and invited ${secretaryName} to record the proceedings.`,
    previous_minutes: {
      status: "Confirmed as a true record",
      notes:
        `${secretaryName} presented the previous minutes for confirmation and members agreed that any pending follow-up items would continue to be tracked.`,
    },
    financial_matters: buildFinancialDraft(safeAgendaItems, leadershipNames),
    next_meeting: {
      date: addOneMonth(meetingDate),
      note:
        "The next meeting will review action progress, unresolved agenda items, and any emerging organizational priorities.",
    },
    adjournment: {
      time: "",
      note:
        `${chairpersonName} thanked members for their participation and encouraged timely follow-up on the agreed actions before the next meeting.`,
    },
  };
};

export const mergeMinutesDraft = (currentValue = {}, draftValue = {}, { overwrite = false } = {}) => {
  const current = createMinutesData(currentValue);
  const draft = createMinutesData(draftValue);

  const pickText = (currentText, draftText) => {
    if (overwrite) return toText(draftText);
    return hasText(currentText) ? toText(currentText) : toText(draftText);
  };

  return {
    preliminaries: pickText(current.preliminaries, draft.preliminaries),
    previous_minutes: {
      status: pickText(current.previous_minutes.status, draft.previous_minutes.status),
      notes: pickText(current.previous_minutes.notes, draft.previous_minutes.notes),
    },
    financial_matters: {
      discussion: pickText(current.financial_matters.discussion, draft.financial_matters.discussion),
      resolution: pickText(current.financial_matters.resolution, draft.financial_matters.resolution),
    },
    next_meeting: {
      date: pickText(current.next_meeting.date, draft.next_meeting.date),
      note: pickText(current.next_meeting.note, draft.next_meeting.note),
    },
    adjournment: {
      time: pickText(current.adjournment.time, draft.adjournment.time),
      note: pickText(current.adjournment.note, draft.adjournment.note),
    },
  };
};
