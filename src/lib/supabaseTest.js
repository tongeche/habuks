import { supabase, isSupabaseConfigured } from "./supabase.js";

const ensureSupabase = () => {
  if (!isSupabaseConfigured || !supabase) {
    const message =
      "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.";
    console.warn(message);
    return { ok: false, message };
  }
  return { ok: true };
};

export async function testSupabaseConnection() {
  console.log("Testing Supabase connection...");

  try {
    const ready = ensureSupabase();
    if (!ready.ok) {
      return { success: false, error: ready.message };
    }
    // Test 1: Check if we can connect
    const { data, error } = await supabase.from("members").select("count", { count: "exact", head: true });

    if (error) {
      console.error("❌ Supabase connection error:", error.message);
      return { success: false, error: error.message };
    }

    console.log("✅ Supabase connected successfully!");
    return { success: true, message: "Connected to Supabase" };
  } catch (err) {
    console.error("❌ Unexpected error:", err);
    return { success: false, error: err.message };
  }
}

export async function fetchMembers() {
  const ready = ensureSupabase();
  if (!ready.ok) {
    return [];
  }
  const { data, error } = await supabase
    .from("members")
    .select("id, name, email, phone_number, status, role")
    .order("id");

  if (error) {
    console.error("Error fetching members:", error);
    return [];
  }

  return data;
}

export async function fetchPayoutSchedule() {
  const ready = ensureSupabase();
  if (!ready.ok) {
    return [];
  }
  const { data, error } = await supabase
    .from("payouts")
    .select(`
      id,
      amount,
      date,
      cycle_number,
      members (id, name)
    `)
    .order("cycle_number");

  if (error) {
    console.error("Error fetching payouts:", error);
    return [];
  }

  return data;
}

export async function fetchContributions(memberId) {
  const ready = ensureSupabase();
  if (!ready.ok) {
    return [];
  }
  const { data, error } = await supabase
    .from("contributions")
    .select("*")
    .eq("member_id", memberId)
    .order("date", { ascending: false });

  if (error) {
    console.error("Error fetching contributions:", error);
    return [];
  }

  return data;
}

export async function fetchWelfareBalance() {
  const ready = ensureSupabase();
  if (!ready.ok) {
    return null;
  }
  const { data, error } = await supabase
    .from("welfare_balances")
    .select("*")
    .order("cycle_id", { ascending: false })
    .limit(1)
    .single();

  if (error) {
    console.error("Error fetching welfare balance:", error);
    return null;
  }

  return data;
}

// Run test if this file is executed directly
if (typeof window !== "undefined") {
  window.testSupabase = testSupabaseConnection;
  window.fetchMembers = fetchMembers;
  window.fetchPayoutSchedule = fetchPayoutSchedule;
}
