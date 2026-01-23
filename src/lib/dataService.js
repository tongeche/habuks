/**
 * Get all members with their total welfare transaction amount (for admin UI)
 */
export async function getMembersWithTotalWelfare() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase not configured");
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
import { supabase, isSupabaseConfigured } from "./supabase.js";

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
      const { data: existingMember, error: lookupError } = await supabase
        .from("members")
        .select("*")
        .eq("email", payload.email)
        .maybeSingle();

      if (lookupError || !existingMember) {
        console.error("Error creating member profile:", insertError);
        return null;
      }

      const { data: updatedMember, error: updateError } = await supabase
        .from("members")
        .update({ auth_id: payload.auth_id })
        .eq("id", existingMember.id)
        .select("*")
        .single();

      if (updateError) {
        console.error("Error linking existing member profile:", updateError);
        return null;
      }

      return updatedMember;
    }

    console.error("Error creating member profile:", insertError);
    return null;
  }

  return createdMember;
}

/**
 * Get contributions for a specific member
 */
export async function getMemberContributions(memberId) {
  // Mock contributions for development (Timothy's 2 contributions)
  const mockContributions = [
    { id: 1, member_id: memberId, amount: 500, date: '2025-12-15', cycle_number: 1 },
    { id: 2, member_id: memberId, amount: 500, date: '2025-12-30', cycle_number: 2 },
  ];

  if (!isSupabaseConfigured || !supabase) return mockContributions;

  const { data, error } = await supabase
    .from("contributions")
    .select("*")
    .eq("member_id", memberId)
    .order("date", { ascending: false });

  if (error) {
    console.error("Error fetching contributions:", error);
    return [];
  }

  return data || [];
}

/**
 * Get contribution split transactions for a specific member
 */
export async function getContributionSplits(memberId) {
  if (!isSupabaseConfigured || !supabase) return [];

  const { data, error } = await supabase
    .from("contribution_splits")
    .select("*")
    .eq("member_id", memberId)
    .order("date", { ascending: false });

  if (error) {
    console.error("Error fetching contribution splits:", error);
    return [];
  }

  return data || [];
}

/**
 * Get payout schedule with member names
 */
export async function getPayoutSchedule() {
  // Mock payout schedule for development
  const mockPayouts = [
    { id: 1, cycle_number: 1, date: '2025-12-15', amount: 5000, member_id: 1, members: { name: 'Orpah Achieng' } },
    { id: 2, cycle_number: 2, date: '2025-12-30', amount: 5000, member_id: 2, members: { name: 'Shadrack Otieno' } },
    { id: 3, cycle_number: 3, date: '2026-01-15', amount: 5000, member_id: 3, members: { name: 'Ketty Awino' } },
    { id: 4, cycle_number: 4, date: '2026-01-30', amount: 5000, member_id: 4, members: { name: 'Eunice Anyango' } },
    { id: 5, cycle_number: 5, date: '2026-02-15', amount: 5000, member_id: 5, members: { name: 'Helida Auma' } },
    { id: 6, cycle_number: 6, date: '2026-02-28', amount: 5000, member_id: 6, members: { name: 'Moses Omondi' } },
    { id: 7, cycle_number: 7, date: '2026-03-15', amount: 5000, member_id: 7, members: { name: 'Sipora Adhiambo' } },
    { id: 8, cycle_number: 8, date: '2026-03-30', amount: 5000, member_id: 8, members: { name: 'Timothy Ongeche' } },
    { id: 9, cycle_number: 9, date: '2026-04-15', amount: 5000, member_id: 9, members: { name: 'Peres Atieno' } },
    { id: 10, cycle_number: 10, date: '2026-04-30', amount: 5000, member_id: 10, members: { name: 'Mitchell Achieng' } },
    { id: 11, cycle_number: 11, date: '2026-05-15', amount: 5000, member_id: 11, members: { name: 'Rosa Awuor' } },
    { id: 12, cycle_number: 12, date: '2026-05-30', amount: 5000, member_id: 12, members: { name: 'Quinter Atieno' } },
  ];

  if (!isSupabaseConfigured || !supabase) return mockPayouts;

  const { data, error } = await supabase
    .from("payouts")
    .select(`
      *,
      members (id, name)
    `)
    .order("cycle_number", { ascending: true });

  if (error) {
    console.error("Error fetching payouts:", error);
    return [];
  }

  return data || [];
}

/**
 * Get a specific member's payout info
 */
export async function getMemberPayout(memberId) {
  if (!isSupabaseConfigured || !supabase) return null;

  const { data, error } = await supabase
    .from("payouts")
    .select("*")
    .eq("member_id", memberId)
    .single();

  if (error) {
    console.error("Error fetching member payout:", error);
    return null;
  }

  return data;
}

/**
 * Get welfare balance for a member
 */
export async function getWelfareBalance(memberId) {
  if (!isSupabaseConfigured || !supabase) return null;

  const { data, error } = await supabase
    .from("welfare_balances")
    .select("*")
    .eq("member_id", memberId)
    .single();

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
export async function getWelfareTransactions(memberId) {
  // Mock data for development with recipient names
  const mockTransactions = [
    { id: 1, date_of_issue: '2025-12-15', recipient: 'Orpah Achieng', amount: 1000, status: 'Completed' },
    { id: 2, date_of_issue: '2025-12-30', recipient: 'Shadrack Otieno', amount: 1000, status: 'Completed' },
  ];

  if (!isSupabaseConfigured || !supabase) return mockTransactions;

  // Try to use the view first (includes recipient names)
  let { data, error } = await supabase
    .from("welfare_transactions_view")
    .select("id, recipient, date_of_issue, amount, status")
    .order("date_of_issue", { ascending: false });

  // Fallback to regular table with join if view doesn't exist
  if (error) {
    const result = await supabase
      .from("welfare_transactions")
      .select(`
        id,
        date,
        amount,
        status,
        members (first_name, last_name)
      `)
      .order("date", { ascending: false });

    if (result.error) {
      console.error("Error fetching welfare transactions:", result.error);
      return mockTransactions;
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

  return data && data.length > 0 ? data : mockTransactions;
}

/**
 * Get total welfare fund (current balance)
 */
export async function getTotalWelfareFund() {
  if (!isSupabaseConfigured || !supabase) {
    // Mock: 2 cycles completed = Ksh. 2,000
    return 2000;
  }

  // Get the latest welfare balance
  const { data, error } = await supabase
    .from("welfare_balances")
    .select("balance, cycle_id")
    .order("cycle_id", { ascending: false })
    .limit(1)
    .single();

  if (error) {
    console.error("Error fetching welfare balance:", error);
    // Fallback: calculate from completed cycles
    return await calculateWelfareFromCycles();
  }

  return data?.balance || 0;
}

/**
 * Calculate welfare balance from completed cycles
 */
async function calculateWelfareFromCycles() {
  if (!isSupabaseConfigured || !supabase) return 2000;

  const { data, error } = await supabase
    .from("welfare_cycles")
    .select("cycle_number")
    .lte("end_date", new Date().toISOString().split("T")[0])
    .order("cycle_number", { ascending: false })
    .limit(1)
    .single();

  if (error) {
    console.error("Error calculating welfare:", error);
    return 2000; // Default 2 cycles
  }

  // Ksh. 1,000 per cycle
  return (data?.cycle_number || 2) * 1000;
}

/**
 * Get welfare summary with cycle details
 */
export async function getWelfareSummary() {
  const mockSummary = {
    currentBalance: 2000,
    completedCycles: 2,
    totalCycles: 12,
    contributionPerCycle: 1000,
    finalAmount: 12000,
    nextPayoutDate: '2026-01-15',
    nextRecipient: 'Ketty',
    cycles: [
      { cycle_number: 1, payout_date: '2025-12-15', recipient: 'Orpah', welfare_balance: 1000, status: 'Completed' },
      { cycle_number: 2, payout_date: '2025-12-30', recipient: 'Shadrack', welfare_balance: 2000, status: 'Completed' },
      { cycle_number: 3, payout_date: '2026-01-15', recipient: 'Ketty', welfare_balance: 3000, status: 'Upcoming' },
      { cycle_number: 4, payout_date: '2026-01-30', recipient: 'Eunice', welfare_balance: 4000, status: 'Upcoming' },
      { cycle_number: 5, payout_date: '2026-02-15', recipient: 'Helida', welfare_balance: 5000, status: 'Upcoming' },
      { cycle_number: 6, payout_date: '2026-02-28', recipient: 'Moses', welfare_balance: 6000, status: 'Upcoming' },
      { cycle_number: 7, payout_date: '2026-03-15', recipient: 'Sipora', welfare_balance: 7000, status: 'Upcoming' },
      { cycle_number: 8, payout_date: '2026-03-30', recipient: 'Timothy', welfare_balance: 8000, status: 'Upcoming' },
      { cycle_number: 9, payout_date: '2026-04-15', recipient: 'Peres', welfare_balance: 9000, status: 'Upcoming' },
      { cycle_number: 10, payout_date: '2026-04-30', recipient: 'Mitchell', welfare_balance: 10000, status: 'Upcoming' },
      { cycle_number: 11, payout_date: '2026-05-15', recipient: 'Rosa', welfare_balance: 11000, status: 'Upcoming' },
      { cycle_number: 12, payout_date: '2026-05-30', recipient: 'Quinter', welfare_balance: 12000, status: 'Upcoming' },
    ]
  };

  if (!isSupabaseConfigured || !supabase) return mockSummary;

  try {
    // Get welfare cycles
    const { data: cycles, error: cyclesError } = await supabase
      .from("welfare_cycles")
      .select("*")
      .order("cycle_number", { ascending: true });

    if (cyclesError || !cycles || cycles.length === 0) {
      return mockSummary;
    }

    // Get payout schedule to match recipients
    const { data: payouts } = await supabase
      .from("payouts")
      .select("cycle_number, member_id, members(name)")
      .order("cycle_number", { ascending: true });

    const payoutMap = {};
    (payouts || []).forEach(p => {
      payoutMap[p.cycle_number] = p.members?.name || 'TBD';
    });

    const today = new Date().toISOString().split("T")[0];
    let completedCycles = 0;
    let currentBalance = 0;

    const enrichedCycles = cycles.map(c => {
      const isCompleted = c.end_date <= today;
      if (isCompleted) {
        completedCycles++;
        currentBalance = c.cycle_number * 1000;
      }

      return {
        cycle_number: c.cycle_number,
        payout_date: c.start_date,
        recipient: payoutMap[c.cycle_number] || mockSummary.cycles[c.cycle_number - 1]?.recipient || 'TBD',
        welfare_balance: c.cycle_number * 1000,
        status: isCompleted ? 'Completed' : (c.start_date <= today ? 'In Progress' : 'Upcoming')
      };
    });

    const nextCycle = enrichedCycles.find(c => c.status === 'Upcoming' || c.status === 'In Progress');

    return {
      currentBalance,
      completedCycles,
      totalCycles: 12,
      contributionPerCycle: 1000,
      finalAmount: 12000,
      nextPayoutDate: nextCycle?.payout_date || null,
      nextRecipient: nextCycle?.recipient || null,
      cycles: enrichedCycles
    };
  } catch (error) {
    console.error("Error fetching welfare summary:", error);
    return mockSummary;
  }
}

/**
 * Get all IGA projects
 */
export async function getProjects() {
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

  if (!isSupabaseConfigured || !supabase) return mockProjects;

  const { data, error } = await supabase
    .from("iga_projects")
    .select(`
      *,
      project_leader_member:members!iga_projects_project_leader_fkey (name)
    `)
    .order("start_date", { ascending: false });

  if (error) {
    console.error("Error fetching projects:", error);
    return [];
  }

  return data || [];
}

/**
 * Get projects with member's participation status
 */
export async function getProjectsWithMembership(memberId) {
  // Mock data for development or when no projects exist
  const mockProjects = [
    {
      id: 1,
      code: "JGF",
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
      name: "Poultry Keeping Project",
      description: "Egg and broiler production for local markets and group consumption.",
      status: "Active", 
      start_date: "2025-09-15",
      member_count: 5,
      membership: null
    }
  ];

  if (!isSupabaseConfigured || !supabase) {
    // Return mock data for development
    return mockProjects;
  }

  try {
    // Get all projects - simplified query without complex joins
    const { data: projects, error: projectsError } = await supabase
      .from("iga_projects")
      .select("id, code, name, description, status, start_date, project_leader")
      .order("start_date", { ascending: false });

    if (projectsError) {
      console.error("Error fetching projects:", projectsError);
      return mockProjects;
    }

    // If no projects in database, return mock data
    if (!projects || projects.length === 0) {
      console.log("No projects found in database, using mock data");
      return mockProjects;
    }

    // Get member count for each project
    const projectsWithCounts = await Promise.all(
      projects.map(async (project) => {
        let memberCount = 0;
        let membership = null;

        try {
          const { count } = await supabase
            .from("iga_committee_members")
            .select("*", { count: "exact", head: true })
            .eq("project_id", project.id);
          memberCount = count || 0;
        } catch (e) {
          console.log("Error getting member count:", e);
        }

        // Check if current member is part of this project
        if (memberId) {
          try {
            const { data: memberData } = await supabase
              .from("iga_committee_members")
              .select("term_start, role")
              .eq("project_id", project.id)
              .eq("member_id", memberId)
              .maybeSingle();
            
            membership = memberData;
          } catch (e) {
            console.log("Error checking membership:", e);
          }
        }

        return {
          ...project,
          member_count: memberCount,
          membership
        };
      })
    );

    return projectsWithCounts;
  } catch (error) {
    console.error("Error in getProjectsWithMembership:", error);
    return mockProjects;
  }
}

/**
 * Join an IGA project
 */
export async function joinProject(projectId, memberId) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  // Check if already a member
  const { data: existing } = await supabase
    .from("iga_committee_members")
    .select("id")
    .eq("project_id", projectId)
    .eq("member_id", memberId)
    .single();

  if (existing) {
    throw new Error("You are already a member of this project");
  }

  const { data, error } = await supabase
    .from("iga_committee_members")
    .insert({
      project_id: projectId,
      member_id: memberId,
      role: "Member",
      term_start: new Date().toISOString().split("T")[0]
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
export async function leaveProject(projectId, memberId) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  const { error } = await supabase
    .from("iga_committee_members")
    .delete()
    .eq("project_id", projectId)
    .eq("member_id", memberId);

  if (error) {
    console.error("Error leaving project:", error);
    throw new Error("Failed to leave project");
  }

  return true;
}

/**
 * Get JPP batches
 */
export async function getJppBatches() {
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

  const { data, error } = await supabase
    .from("jpp_batches")
    .select("*")
    .order("start_date", { ascending: false });

  if (error) {
    console.error("Error fetching JPP batches:", error);
    throw error;
  }

  return data || [];
}

/**
 * Get JPP batch KPIs
 */
export async function getJppBatchKpis() {
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

  const { data, error } = await supabase
    .from("v_jpp_batch_kpis")
    .select("*")
    .order("start_date", { ascending: false });

  if (error) {
    console.error("Error fetching JPP batch KPIs:", error);
    return [];
  }

  return data || [];
}

/**
 * Get JPP module counts
 */
export async function getJppModuleCounts() {
  const mockCounts = { dailyLogs: 18, weeklyGrowth: 4, expenses: 12 };

  if (!isSupabaseConfigured || !supabase) return mockCounts;

  try {
    const projectId = await resolveProjectId("JPP");
    const [dailyRes, weeklyRes, expensesRes] = await Promise.all([
      supabase.from("jpp_daily_log").select("*", { count: "exact", head: true }),
      supabase.from("jpp_weekly_growth").select("*", { count: "exact", head: true }),
      supabase
        .from("project_expenses")
        .select("*", { count: "exact", head: true })
        .eq("project_id", projectId),
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
export async function getJppDailyLogs() {
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

  const { data, error } = await supabase
    .from("jpp_daily_log")
    .select("*")
    .order("log_date", { ascending: false });

  if (error) {
    console.error("Error fetching JPP daily logs:", error);
    throw error;
  }

  return data || [];
}

/**
 * Get JPP weekly growth logs
 */
export async function getJppWeeklyGrowth() {
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

  const { data, error } = await supabase
    .from("jpp_weekly_growth")
    .select("*")
    .order("week_ending", { ascending: false });

  if (error) {
    console.error("Error fetching JPP weekly growth:", error);
    throw error;
  }

  return data || [];
}

/**
 * Get JPP birds
 */
export async function getJppBirds() {
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

  let { data, error } = await supabase
    .from("v_jpp_bird_cards")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    const fallback = await supabase
      .from("jpp_birds")
      .select("*")
      .order("created_at", { ascending: false });
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
export async function getProjectExpenses(projectRef) {
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

  const projectId = await resolveProjectId(projectRef);
  const { data, error } = await supabase
    .from("project_expenses")
    .select("*")
    .eq("project_id", projectId)
    .order("expense_date", { ascending: false });

  if (error) {
    console.error("Error fetching project expenses:", error);
    throw error;
  }

  return data || [];
}

/**
 * Get project expenses for multiple projects (by ids)
 */
export async function getProjectExpensesForProjects(projectIds) {
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

  const { data, error } = await supabase
    .from("project_expenses")
    .select("*")
    .in("project_id", safeIds)
    .order("expense_date", { ascending: false });

  if (error) {
    console.error("Error fetching project expenses:", error);
    throw error;
  }

  return data || [];
}

/**
 * Get recent expenses across multiple projects
 */
export async function getRecentProjectExpenses(projectIds = [], limit = 3) {
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

  const { data, error } = await supabase
    .from("project_expenses")
    .select("*")
    .in("project_id", projectIds)
    .order("expense_date", { ascending: false })
    .limit(safeLimit);

  if (error) {
    console.error("Error fetching recent project expenses:", error);
    throw error;
  }

  return data || [];
}

/**
 * Get project sales (by project code or id)
 */
export async function getProjectSales(projectRef) {
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

  const projectId = await resolveProjectId(projectRef);
  const { data, error } = await supabase
    .from("project_sales")
    .select("*")
    .eq("project_id", projectId)
    .order("sale_date", { ascending: false });

  if (error) {
    console.error("Error fetching project sales:", error);
    throw error;
  }

  return data || [];
}

/**
 * Get project sales for multiple projects (by ids)
 */
export async function getProjectSalesForProjects(projectIds) {
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

  const { data, error } = await supabase
    .from("project_sales")
    .select("*")
    .in("project_id", safeIds)
    .order("sale_date", { ascending: false });

  if (error) {
    console.error("Error fetching project sales:", error);
    throw error;
  }

  return data || [];
}

/**
 * Get project products (by project code or id)
 */
export async function getProjectProducts(projectRef, options = {}) {
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

  const projectId = await resolveProjectId(projectRef);
  let query = supabase
    .from("project_products")
    .select("id, name, category, tracking_mode, unit, is_active")
    .eq("project_id", projectId)
    .eq("is_active", true)
    .order("name", { ascending: true });

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
export async function getJppExpenses() {
  return getProjectExpenses("JPP");
}

async function resolveProjectId(projectRef) {
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

  const projectCode = trimmed.toUpperCase();
  const { data: project, error } = await supabase
    .from("iga_projects")
    .select("id")
    .eq("code", projectCode)
    .maybeSingle();

  if (error) {
    console.error("Error fetching project by code:", error);
    throw error;
  }

  if (!project) {
    throw new Error(`Project not found for code ${projectCode}.`);
  }

  return project.id;
}

/**
 * Get project expense items (by project code or id)
 */
export async function getProjectExpenseItems(projectRef) {
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

  const projectId = await resolveProjectId(projectRef);

  const { data, error } = await supabase
    .from("project_expense_items")
    .select("id, label, category, display_order, is_active")
    .eq("project_id", projectId)
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  if (error) {
    console.error("Error fetching project expense items:", error);
    throw error;
  }

  return data || [];
}

export async function getProjectExpenseCategories(projectRef) {
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

  const projectId = await resolveProjectId(projectRef);

  const { data, error } = await supabase
    .from("project_expense_items")
    .select("category, display_order")
    .eq("project_id", projectId)
    .eq("is_active", true)
    .not("category", "is", null)
    .order("display_order", { ascending: true });

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

export async function createProjectExpenseItem(projectRef, payload) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  const projectId = await resolveProjectId(projectRef);

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

export async function updateProjectExpenseItem(itemId, payload) {
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

  const { data, error } = await supabase
    .from("project_expense_items")
    .update(updatePayload)
    .eq("id", itemId)
    .select()
    .single();

  if (error) {
    console.error("Error updating project expense item:", error);
    throw error;
  }

  return data;
}

export async function createJppBatch(payload) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  const { data, error } = await supabase
    .from("jpp_batches")
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error("Error creating JPP batch:", error);
    throw new Error("Failed to create batch");
  }

  return data;
}

export async function updateJppBatch(batchId, payload) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  const { data, error } = await supabase
    .from("jpp_batches")
    .update(payload)
    .eq("id", batchId)
    .select()
    .single();

  if (error) {
    console.error("Error updating JPP batch:", error);
    throw new Error("Failed to update batch");
  }

  return data;
}

export async function deleteJppBatch(batchId) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  const { error } = await supabase
    .from("jpp_batches")
    .delete()
    .eq("id", batchId);

  if (error) {
    console.error("Error deleting JPP batch:", error);
    throw new Error("Failed to delete batch");
  }

  return true;
}

export async function createJppDailyLog(payload) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  const { data, error } = await supabase
    .from("jpp_daily_log")
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error("Error creating JPP daily log:", error);
    throw new Error("Failed to create daily log");
  }

  return data;
}

export async function updateJppDailyLog(logId, payload) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  const { data, error } = await supabase
    .from("jpp_daily_log")
    .update(payload)
    .eq("id", logId)
    .select()
    .single();

  if (error) {
    console.error("Error updating JPP daily log:", error);
    throw new Error("Failed to update daily log");
  }

  return data;
}

export async function deleteJppDailyLog(logId) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  const { error } = await supabase
    .from("jpp_daily_log")
    .delete()
    .eq("id", logId);

  if (error) {
    console.error("Error deleting JPP daily log:", error);
    throw new Error("Failed to delete daily log");
  }

  return true;
}

export async function createJppWeeklyGrowth(payload) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  const { data, error } = await supabase
    .from("jpp_weekly_growth")
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error("Error creating JPP weekly growth:", error);
    throw new Error("Failed to create weekly growth entry");
  }

  return data;
}

export async function updateJppWeeklyGrowth(entryId, payload) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  const { data, error } = await supabase
    .from("jpp_weekly_growth")
    .update(payload)
    .eq("id", entryId)
    .select()
    .single();

  if (error) {
    console.error("Error updating JPP weekly growth:", error);
    throw new Error("Failed to update weekly growth entry");
  }

  return data;
}

export async function deleteJppWeeklyGrowth(entryId) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  const { error } = await supabase
    .from("jpp_weekly_growth")
    .delete()
    .eq("id", entryId);

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

export async function createJppBird(payload) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  const user = await getCurrentMember();

  const insertPayload = {
    product_id: payload.product_id,
    batch_id: normalizeOptional(payload.batch_id),
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

export async function createProjectExpense(projectRef, payload) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  const projectId = await resolveProjectId(projectRef);
  const receipt =
    "receipt" in payload ? Boolean(payload.receipt) : Boolean(payload.receipt_available);

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
  };

  const { data, error } = await supabase
    .from("project_expenses")
    .insert(insertPayload)
    .select();

  if (error) {
    console.error("Error creating project expense:", error);
    throw error;
  }

  return data?.[0] || null;
}

export async function updateProjectExpense(expenseId, payload) {
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
  if ("approved_by" in payload) updatePayload.approved_by = payload.approved_by;
  if ("created_by" in payload) updatePayload.created_by = payload.created_by;

  if (Object.keys(updatePayload).length === 0) {
    throw new Error("No fields to update");
  }

  updatePayload.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("project_expenses")
    .update(updatePayload)
    .eq("id", expenseId)
    .select();

  if (error) {
    console.error("Error updating project expense:", error);
    throw error;
  }

  return data?.[0] || null;
}

export async function deleteProjectExpense(expenseId) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  const { error } = await supabase
    .from("project_expenses")
    .delete()
    .eq("id", expenseId);

  if (error) {
    console.error("Error deleting project expense:", error);
    throw error;
  }

  return true;
}

export async function createProjectSale(projectRef, payload) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  const projectId = await resolveProjectId(projectRef);

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

export async function updateProjectSale(saleId, payload) {
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

  const { data, error } = await supabase
    .from("project_sales")
    .update(updatePayload)
    .eq("id", saleId)
    .select();

  if (error) {
    console.error("Error updating project sale:", error);
    throw error;
  }

  return data?.[0] || null;
}

export async function deleteProjectSale(saleId) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  const { error } = await supabase
    .from("project_sales")
    .delete()
    .eq("id", saleId);

  if (error) {
    console.error("Error deleting project sale:", error);
    throw error;
  }

  return true;
}

export async function createJppExpense(payload) {
  return createProjectExpense("JPP", payload);
}

export async function updateJppExpense(expenseId, payload) {
  return updateProjectExpense(expenseId, payload);
}

export async function deleteJppExpense(expenseId) {
  return deleteProjectExpense(expenseId);
}

// ============================================
// JGF (GROUNDNUT FOODS) PROJECT FUNCTIONS
// ============================================

/**
 * Get JGF batches
 */
export async function getJgfBatches() {
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

  const { data, error } = await supabase
    .from("jgf_batches")
    .select("*")
    .order("start_date", { ascending: false });

  if (error) {
    console.error("Error fetching JGF batches:", error);
    throw error;
  }

  return data || [];
}

/**
 * Get JGF batch KPIs
 */
export async function getJgfBatchKpis() {
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

  const { data, error } = await supabase
    .from("jgf_batch_kpis")
    .select("*")
    .order("start_date", { ascending: false });

  if (error) {
    console.error("Error fetching JGF batch KPIs:", error);
    return [];
  }

  return data || [];
}

/**
 * Get JGF inventory
 */
export async function getJgfInventory() {
  const mockInventory = [
    { id: 1, item_type: "raw_material", item_name: "Raw Groundnuts", quantity: 150, unit: "kg", unit_cost: 150, reorder_level: 50 },
    { id: 2, item_type: "packaging", item_name: "Glass Jars 500g", quantity: 200, unit: "units", unit_cost: 45, reorder_level: 100 },
    { id: 3, item_type: "product", item_name: "Peanut Butter 500g", quantity: 24, unit: "units", unit_cost: 0, reorder_level: 0 },
  ];

  if (!isSupabaseConfigured || !supabase) return mockInventory;

  const { data, error } = await supabase
    .from("jgf_inventory")
    .select("*")
    .order("item_type", { ascending: true });

  if (error) {
    console.error("Error fetching JGF inventory:", error);
    throw error;
  }

  return data || [];
}

/**
 * Get JGF production logs
 */
export async function getJgfProductionLogs() {
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

  const { data, error } = await supabase
    .from("jgf_production_logs")
    .select("*")
    .order("log_date", { ascending: false });

  if (error) {
    console.error("Error fetching JGF production logs:", error);
    throw error;
  }

  return data || [];
}

/**
 * Get JGF sales
 */
export async function getJgfSales() {
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

  return getProjectSales("JGF");
}

/**
 * Get JGF expenses
 */
export async function getJgfExpenses() {
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

  const expenses = await getProjectExpenses("JGF");
  return expenses.map((expense) => ({
    ...expense,
    receipt_available: Boolean(expense.receipt),
  }));
}

/**
 * Get JGF purchases
 */
export async function getJgfPurchases() {
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

  const { data, error } = await supabase
    .from("jgf_purchases")
    .select("*")
    .order("purchase_date", { ascending: false });

  if (error) {
    console.error("Error fetching JGF purchases:", error);
    throw error;
  }

  return data || [];
}

// JGF CRUD Operations

export async function createJgfBatch(payload) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  const { data, error } = await supabase
    .from("jgf_batches")
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error("Error creating JGF batch:", error);
    throw new Error("Failed to create batch");
  }

  return data;
}

export async function updateJgfBatch(batchId, payload) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  const { data, error } = await supabase
    .from("jgf_batches")
    .update(payload)
    .eq("id", batchId)
    .select()
    .single();

  if (error) {
    console.error("Error updating JGF batch:", error);
    throw new Error("Failed to update batch");
  }

  return data;
}

export async function deleteJgfBatch(batchId) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  const { error } = await supabase
    .from("jgf_batches")
    .delete()
    .eq("id", batchId);

  if (error) {
    console.error("Error deleting JGF batch:", error);
    throw new Error("Failed to delete batch");
  }

  return true;
}

export async function createJgfProductionLog(payload) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  const { data, error } = await supabase
    .from("jgf_production_logs")
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error("Error creating JGF production log:", error);
    throw new Error("Failed to create production log");
  }

  return data;
}

export async function updateJgfProductionLog(logId, payload) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  const { data, error } = await supabase
    .from("jgf_production_logs")
    .update(payload)
    .eq("id", logId)
    .select()
    .single();

  if (error) {
    console.error("Error updating JGF production log:", error);
    throw new Error("Failed to update production log");
  }

  return data;
}

export async function deleteJgfProductionLog(logId) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  const { error } = await supabase
    .from("jgf_production_logs")
    .delete()
    .eq("id", logId);

  if (error) {
    console.error("Error deleting JGF production log:", error);
    throw new Error("Failed to delete production log");
  }

  return true;
}

export async function createJgfSale(payload) {
  return createProjectSale("JGF", payload);
}

export async function updateJgfSale(saleId, payload) {
  return updateProjectSale(saleId, payload);
}

export async function deleteJgfSale(saleId) {
  return deleteProjectSale(saleId);
}

export async function createJgfExpense(payload) {
  return createProjectExpense("JGF", payload);
}

export async function updateJgfExpense(expenseId, payload) {
  return updateProjectExpense(expenseId, payload);
}

export async function deleteJgfExpense(expenseId) {
  return deleteProjectExpense(expenseId);
}

export async function updateJgfInventory(itemId, payload) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  const { data, error } = await supabase
    .from("jgf_inventory")
    .update(payload)
    .eq("id", itemId)
    .select()
    .single();

  if (error) {
    console.error("Error updating JGF inventory:", error);
    throw new Error("Failed to update inventory");
  }

  return data;
}

export async function createJgfPurchase(payload) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  const { data, error } = await supabase
    .from("jgf_purchases")
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error("Error creating JGF purchase:", error);
    throw new Error("Failed to create purchase");
  }

  return data;
}

export async function updateJgfPurchase(purchaseId, payload) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  const { data, error } = await supabase
    .from("jgf_purchases")
    .update(payload)
    .eq("id", purchaseId)
    .select()
    .single();

  if (error) {
    console.error("Error updating JGF purchase:", error);
    throw new Error("Failed to update purchase");
  }

  return data;
}

export async function deleteJgfPurchase(purchaseId) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database not configured");
  }

  const { error } = await supabase
    .from("jgf_purchases")
    .delete()
    .eq("id", purchaseId);

  if (error) {
    console.error("Error deleting JGF purchase:", error);
    throw new Error("Failed to delete purchase");
  }

  return true;
}

// ===================================
// JGF FARMING & LAND FUNCTIONS
// ===================================

export async function getJgfLandLeases() {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("jgf_land_leases")
    .select("*")
    .order("start_date", { ascending: false });
  if (error) {
    console.error("Error fetching land leases:", error);
    return [];
  }
  return data;
}

export async function createJgfLandLease(lease) {
  if (!isSupabaseConfigured) return null;
  const user = await getCurrentMember(); 
  if (!user) return null;

  const { data, error } = await supabase
    .from("jgf_land_leases")
    .insert([{ ...lease, created_by: user.auth_id }]) 
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateJgfLandLease(id, updates) {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase
    .from("jgf_land_leases")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteJgfLandLease(id) {
  if (!isSupabaseConfigured) return null;
  const { error } = await supabase.from("jgf_land_leases").delete().eq("id", id);
  if (error) throw error;
  return true;
}

export async function getJgfCropCycles() {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("jgf_crop_cycles")
    .select(`
      *,
      lease:lease_id (name, location)
    `)
    .order("start_date", { ascending: false });

  if (error) {
    console.error("Error fetching crop cycles:", error);
    return [];
  }
  return data;
}

export async function createJgfCropCycle(cycle) {
  if (!isSupabaseConfigured) return null;
  const user = await getCurrentMember();
  if (!user) return null;

  const { data, error } = await supabase
    .from("jgf_crop_cycles")
    .insert([{ ...cycle, created_by: user.auth_id }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateJgfCropCycle(id, updates) {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase
    .from("jgf_crop_cycles")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteJgfCropCycle(id) {
  if (!isSupabaseConfigured) return null;
  const { error } = await supabase.from("jgf_crop_cycles").delete().eq("id", id);
  if (error) throw error;
  return true;
}

export async function getJgfFarmingLogs(cycleId) {
  if (!isSupabaseConfigured) return [];
  let query = supabase
    .from("jgf_farming_activities")
    .select("*")
    .order("activity_date", { ascending: false });

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

export async function createJgfFarmingLog(log) {
  if (!isSupabaseConfigured) return null;
  const user = await getCurrentMember();
  if (!user) return null;

  const { data, error } = await supabase
    .from("jgf_farming_activities")
    .insert([{ ...log, created_by: user.auth_id }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateJgfFarmingLog(id, updates) {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase
    .from("jgf_farming_activities")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteJgfFarmingLog(id) {
  if (!isSupabaseConfigured) return null;
  const { error } = await supabase.from("jgf_farming_activities").delete().eq("id", id);
  if (error) throw error;
  return true;
}

/**
 * Get blog posts / news
 */
export async function getNews() {
  if (!isSupabaseConfigured || !supabase) return [];

  const { data, error } = await supabase
    .from("blogs")
    .select("*")
    .eq("published", true)
    .order("date", { ascending: false });

  if (error) {
    console.error("Error fetching news:", error);
    return [];
  }

  return data || [];
}

/**
 * Get documents
 */
export async function getDocuments() {
  if (!isSupabaseConfigured || !supabase) return [];

  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .order("uploaded_at", { ascending: false });

  if (error) {
    console.error("Error fetching documents:", error);
    return [];
  }

  return data || [];
}

/**
 * Get meetings
 */
export async function getMeetings() {
  if (!isSupabaseConfigured || !supabase) return [];

  const { data, error } = await supabase
    .from("meetings")
    .select("*")
    .order("date", { ascending: false });

  if (error) {
    console.error("Error fetching meetings:", error);
    return [];
  }

  return data || [];
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
export async function getDashboardStats(memberId) {
  // Mock fallback data for development
  const mockStats = {
    totalContributions: 1000, // 2 cycles × Ksh. 500
    welfareBalance: 2000,     // Group welfare: 2 cycles × Ksh. 1,000
    payoutTurn: 8,            // Timothy is #8
    payoutDate: '2026-03-30', // March 30, 2026
    currentCycle: 2,          // 2 cycles completed (Orpah, Shadrack)
    totalMembers: 12,
    nextRecipient: 'Ketty',
    nextPayoutDate: '2026-01-15',
  };

  if (!isSupabaseConfigured || !supabase) return mockStats;

  try {
    // Get member's total contributions
    const { data: contributions } = await supabase
      .from("contributions")
      .select("amount")
      .eq("member_id", memberId);

    const totalContributions = contributions?.reduce((sum, c) => sum + Number(c.amount), 0) ?? 0;

    // Get member's payout info
    const { data: payout } = await supabase
      .from("payouts")
      .select("cycle_number, date, amount")
      .eq("member_id", memberId)
      .maybeSingle();

    // Get current cycle from welfare_cycles (completed cycles)
    const today = new Date().toISOString().split('T')[0];
    const { data: completedCycles } = await supabase
      .from("welfare_cycles")
      .select("id")
      .lte("end_date", today);

    const currentCycle = completedCycles?.length ?? 0;

    // Get welfare balance (total group welfare)
    const { data: welfareData } = await supabase
      .from("welfare_balances")
      .select("balance")
      .order("cycle_id", { ascending: false })
      .limit(1)
      .maybeSingle();

    const welfareBalance = welfareData?.balance ?? (currentCycle * 1000);

    // Get next upcoming payout
    const { data: nextPayout } = await supabase
      .from("payouts")
      .select(`
        date,
        members (name)
      `)
      .gt("date", today)
      .order("date", { ascending: true })
      .limit(1)
      .maybeSingle();

    // Get total members count
    const { count: totalMembers } = await supabase
      .from("members")
      .select("id", { count: "exact", head: true })
      .eq("status", "active");

    return {
      totalContributions: totalContributions ?? 0,
      welfareBalance: welfareBalance ?? 0,
      payoutTurn: payout?.cycle_number ?? null,
      payoutDate: payout?.date ?? null,
      currentCycle: currentCycle ?? 0,
      totalMembers: totalMembers ?? 0,
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

export async function getMembersAdmin() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase not configured");
  }

  const { data, error } = await supabase
    .from("members")
    .select(
      "id, name, email, phone_number, role, status, join_date, auth_id, gender, national_id, occupation, address, county, sub_county, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship"
    )
    .order("name", { ascending: true });

  if (error) {
    throw error;
  }

  return data || [];
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
    auth_id: normalizeOptional(payload.auth_id),
    password_hash: passwordHash || "admin_created",
    gender: normalizeOptional(payload.gender),
    national_id: normalizeOptional(payload.national_id),
    occupation: normalizeOptional(payload.occupation),
    address: normalizeOptional(payload.address),
    county: normalizeOptional(payload.county),
    sub_county: normalizeOptional(payload.sub_county),
    emergency_contact_name: normalizeOptional(payload.emergency_contact_name),
    emergency_contact_phone: normalizeOptional(payload.emergency_contact_phone),
    emergency_contact_relationship: normalizeOptional(payload.emergency_contact_relationship),
  };

  const { data, error } = await supabase
    .from("members")
    .insert(insertPayload)
    .select()
    .single();

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
    emergency_contact_name: normalizeOptional(payload.emergency_contact_name),
    emergency_contact_phone: normalizeOptional(payload.emergency_contact_phone),
    emergency_contact_relationship: normalizeOptional(payload.emergency_contact_relationship),
  };

  const { data, error } = await supabase
    .from("members")
    .update(updatePayload)
    .eq("id", memberId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function getProjectMembersAdmin(projectId) {
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

  const { data, error } = await supabase
    .from("iga_committee_members")
    .select("id, project_id, member_id, role, term_start, members (id, name, email, phone_number, role, status)")
    .eq("project_id", projectId)
    .order("term_start", { ascending: false });

  if (!error) {
    return data || [];
  }

  const { data: membership, error: membershipError } = await supabase
    .from("iga_committee_members")
    .select("id, project_id, member_id, role, term_start")
    .eq("project_id", projectId);

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

export async function addProjectMemberAdmin({ projectId, memberId, role, term_start }) {
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

  const { data: existing } = await supabase
    .from("iga_committee_members")
    .select("id")
    .eq("project_id", projectId)
    .eq("member_id", memberId)
    .maybeSingle();

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
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function removeProjectMemberAdmin(projectMemberId) {
  if (!projectMemberId) {
    return false;
  }

  if (!isSupabaseConfigured || !supabase) {
    return true;
  }

  const { error } = await supabase
    .from("iga_committee_members")
    .delete()
    .eq("id", projectMemberId);

  if (error) {
    throw error;
  }

  return true;
}

export async function updateProjectMemberAdmin(projectMemberId, payload) {
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

  const { data, error } = await supabase
    .from("iga_committee_members")
    .update(updatePayload)
    .eq("id", projectMemberId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function getMemberInvites() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase not configured");
  }

  const { data, error } = await supabase
    .from("member_invites")
    .select("*")
    .order("created_at", { ascending: false });

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

  const normalized = trimmed.toUpperCase();
  const compact = normalized.replace(/-/g, "");
  const codeHash = await hashInviteCode(normalized);
  let { data, error } = await supabase
    .from("member_invites")
    .select("*")
    .eq("code_hash", codeHash)
    .order("created_at", { ascending: false })
    .limit(2);

  if (error) {
    throw error;
  }

  if (!data?.length && compact.length >= 8) {
    const prefix = compact.slice(0, 8);
    const { data: candidates, error: prefixError } = await supabase
      .from("member_invites")
      .select("*")
      .eq("code_prefix", prefix);
    if (prefixError) {
      throw prefixError;
    }
    if (Array.isArray(candidates)) {
      data =
        candidates.find((invite) => {
          const stored = String(invite.code_hash || "");
          return (
            stored === codeHash ||
            stored.toUpperCase() === normalized ||
            stored.replace(/-/g, "").toUpperCase() === compact
          );
        }) || null;
    }
  }

  const invite = Array.isArray(data) ? data[0] : data;
  if (!invite) {
    throw new Error("Invalid invite code.");
  }

  if (invite.status && String(invite.status).toLowerCase() !== "pending") {
    throw new Error("This invite code is no longer active.");
  }

  if (invite.expires_at) {
    const expiresAt = new Date(invite.expires_at);
    if (!Number.isNaN(expiresAt.getTime()) && expiresAt < new Date()) {
      throw new Error("This invite code has expired.");
    }
  }

  return invite;
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

export async function getWelfareAccounts() {
  const mockAccounts = [
    { id: 1, name: "Main Welfare Fund", description: "Group welfare savings" },
  ];

  if (!isSupabaseConfigured || !supabase) {
    return mockAccounts;
  }

  const { data, error } = await supabase
    .from("welfare_accounts")
    .select("id, name, description")
    .order("name", { ascending: true });

  if (error) {
    console.error("Error fetching welfare accounts:", error);
    return mockAccounts;
  }

  return data || mockAccounts;
}

export async function getWelfareCycles() {
  const mockCycles = [
    { id: 1, cycle_number: 1, start_date: "2025-12-15", end_date: "2025-12-29" },
    { id: 2, cycle_number: 2, start_date: "2025-12-30", end_date: "2026-01-14" },
  ];

  if (!isSupabaseConfigured || !supabase) {
    return mockCycles;
  }

  const { data, error } = await supabase
    .from("welfare_cycles")
    .select("id, cycle_number, start_date, end_date")
    .order("cycle_number", { ascending: true });

  if (error) {
    console.error("Error fetching welfare cycles:", error);
    return mockCycles;
  }

  return data || mockCycles;
}

export async function getWelfareTransactionsAdmin() {
  const mockTransactions = [
    {
      id: 1,
      welfare_account_id: 1,
      cycle_id: 1,
      member_id: 1,
      member: { name: "Orpah Achieng" },
      amount: 1000,
      transaction_type: "contribution",
      date: "2025-12-15",
      description: "Cycle 1 welfare contribution",
      status: "Completed",
    },
    {
      id: 2,
      welfare_account_id: 1,
      cycle_id: 2,
      member_id: null,
      member: null,
      amount: 1000,
      transaction_type: "contribution",
      date: "2025-12-30",
      description: "Cycle 2 welfare contribution",
      status: "Completed",
    },
  ];

  if (!isSupabaseConfigured || !supabase) {
    return mockTransactions;
  }

  const { data, error } = await supabase
    .from("welfare_transactions")
    .select(
      "id, welfare_account_id, cycle_id, member_id, amount, transaction_type, date, description, status, member:members(name)"
    )
    .order("date", { ascending: false });

  if (error) {
    console.error("Error fetching welfare transactions:", error);
    return mockTransactions;
  }

  return data || [];
}

export async function createWelfareTransaction(payload) {
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

export async function updateWelfareTransaction(transactionId, payload) {
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

  const { data, error } = await supabase
    .from("welfare_transactions")
    .update(updatePayload)
    .eq("id", transactionId)
    .select()
    .single();

  if (error) {
    console.error("Error updating welfare transaction:", error);
    throw new Error("Failed to update welfare transaction");
  }

  return data;
}

export async function deleteWelfareTransaction(transactionId) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase not configured");
  }

  const { error } = await supabase.from("welfare_transactions").delete().eq("id", transactionId);

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
export async function getPublicProjects() {
  if (!isSupabaseConfigured || !supabase) {
    console.warn("Supabase not configured, returning mock data");
    return getMockProjects();
  }

  const { data, error } = await supabase
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

  if (error) {
    console.error("Error fetching projects:", error);
    return getMockProjects();
  }

  // Fetch goals and roles for each project
  const projectsWithDetails = await Promise.all(
    (data || []).map(async (project) => {
      const [goalsRes, rolesRes] = await Promise.all([
        supabase
          .from("project_goals")
          .select("id, goal")
          .eq("project_id", project.id)
          .order("display_order"),
        supabase
          .from("project_volunteer_roles")
          .select("id, role_description")
          .eq("project_id", project.id)
          .order("display_order"),
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
export async function getProjectByCode(code) {
  if (!isSupabaseConfigured || !supabase) {
    console.warn("Supabase not configured, returning mock data");
    const mockProjects = getMockProjects();
    return mockProjects.find((p) => p.code === code) || null;
  }

  const { data: project, error } = await supabase
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

  if (error) {
    console.error("Error fetching project:", error);
    const mockProjects = getMockProjects();
    return mockProjects.find((p) => p.code === code) || null;
  }

  // Fetch all related data in parallel
  const [goalsRes, rolesRes, galleryRes, faqRes, activitiesRes, donationItemsRes] = await Promise.all([
    supabase
      .from("project_goals")
      .select("id, goal")
      .eq("project_id", project.id)
      .order("display_order"),
    supabase
      .from("project_volunteer_roles")
      .select("id, role_description")
      .eq("project_id", project.id)
      .order("display_order"),
    supabase
      .from("project_gallery")
      .select("id, image_url, caption")
      .eq("project_id", project.id)
      .order("display_order"),
    supabase
      .from("project_faq")
      .select("id, question, answer")
      .eq("project_id", project.id)
      .order("display_order"),
    supabase
      .from("project_activities")
      .select("id, title, description, icon")
      .eq("project_id", project.id)
      .order("display_order"),
    supabase
      .from("project_donation_items")
      .select("id, item, description, estimated_cost")
      .eq("project_id", project.id)
      .order("display_order"),
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
