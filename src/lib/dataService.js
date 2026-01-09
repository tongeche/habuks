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
    return mockContributions;
  }

  return data && data.length > 0 ? data : mockContributions;
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
    return mockPayouts;
  }

  return data && data.length > 0 ? data : mockPayouts;
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
    return mockProjects;
  }

  return data && data.length > 0 ? data : mockProjects;
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

    console.log("Projects query result:", { projects, projectsError });

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

  if (!isSupabaseConfigured || !supabase) {
    return mockStats;
  }

  try {
    // Get member's total contributions
    const { data: contributions } = await supabase
      .from("contributions")
      .select("amount")
      .eq("member_id", memberId);

    const totalContributions = contributions?.reduce((sum, c) => sum + Number(c.amount), 0) || 0;

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

    const currentCycle = completedCycles?.length || 0;

    // Get welfare balance (total group welfare)
    const { data: welfareData } = await supabase
      .from("welfare_balances")
      .select("balance")
      .order("cycle_id", { ascending: false })
      .limit(1)
      .maybeSingle();

    const welfareBalance = welfareData?.balance || (currentCycle * 1000);

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
      totalContributions: totalContributions || mockStats.totalContributions,
      welfareBalance: welfareBalance || mockStats.welfareBalance,
      payoutTurn: payout?.cycle_number || mockStats.payoutTurn,
      payoutDate: payout?.date || mockStats.payoutDate,
      currentCycle: currentCycle || mockStats.currentCycle,
      totalMembers: totalMembers || mockStats.totalMembers,
      nextRecipient: nextPayout?.members?.name || mockStats.nextRecipient,
      nextPayoutDate: nextPayout?.date || mockStats.nextPayoutDate,
    };
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return mockStats;
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

  const insertPayload = {
    name: normalizeOptional(payload.name),
    email: normalizeOptional(payload.email),
    phone_number: normalizeOptional(payload.phone_number),
    role: normalizeOptional(payload.role) || "member",
    status: normalizeOptional(payload.status) || "active",
    join_date: normalizeOptional(payload.join_date) || new Date().toISOString().slice(0, 10),
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
