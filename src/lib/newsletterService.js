/**
 * Newsletter Service
 * Handles newsletter subscriptions via Supabase
 */

import { supabase, isSupabaseConfigured } from "./supabase.js";

/**
 * Subscribe an email to the newsletter
 * @param {string} email - The email address to subscribe
 * @param {string} source - Where the subscription came from (e.g., 'blog', 'landing', 'footer')
 * @param {object} metadata - Optional additional data
 * @returns {Promise<{success: boolean, error?: string, alreadySubscribed?: boolean}>}
 */
export async function subscribeToNewsletter(email, source = "website", metadata = {}) {
  if (!isSupabaseConfigured) {
    console.warn("Supabase not configured - newsletter subscription not saved");
    // Return success in dev mode to not break the UI
    return { success: true, mock: true };
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    return { success: false, error: "Please enter a valid email address" };
  }

  try {
    const { data, error } = await supabase
      .from("newsletter_subscribers")
      .insert({
        email: email.toLowerCase().trim(),
        source,
        metadata,
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      })
      .select()
      .single();

    if (error) {
      // Handle duplicate email (already subscribed)
      if (error.code === "23505") {
        return { success: true, alreadySubscribed: true };
      }
      console.error("Newsletter subscription error:", error);
      return { success: false, error: "Something went wrong. Please try again." };
    }

    return { success: true, data };
  } catch (err) {
    console.error("Newsletter subscription error:", err);
    return { success: false, error: "Something went wrong. Please try again." };
  }
}

/**
 * Check if an email is already subscribed
 * @param {string} email - The email to check
 * @returns {Promise<boolean>}
 */
export async function isEmailSubscribed(email) {
  if (!isSupabaseConfigured) {
    return false;
  }

  try {
    const { data, error } = await supabase
      .from("newsletter_subscribers")
      .select("id, status")
      .eq("email", email.toLowerCase().trim())
      .single();

    if (error || !data) {
      return false;
    }

    return data.status === "active";
  } catch {
    return false;
  }
}

/**
 * Unsubscribe an email (for admin use or unsubscribe links)
 * @param {string} email - The email to unsubscribe
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function unsubscribeEmail(email) {
  if (!isSupabaseConfigured) {
    return { success: false, error: "Service not configured" };
  }

  try {
    const { error } = await supabase
      .from("newsletter_subscribers")
      .update({
        status: "unsubscribed",
        unsubscribed_at: new Date().toISOString(),
      })
      .eq("email", email.toLowerCase().trim());

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
