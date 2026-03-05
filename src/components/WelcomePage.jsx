import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase, isSupabaseConfigured } from "../lib/supabase.js";

const getStoredDashboardPath = () => {
  if (typeof window === "undefined") return "/dashboard";
  const slug = String(window.localStorage.getItem("lastTenantSlug") || "")
    .trim()
    .toLowerCase();
  return slug ? `/tenant/${slug}/dashboard` : "/dashboard";
};

export default function WelcomePage() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      return;
    }
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (data?.session?.user) {
        navigate(getStoredDashboardPath(), { replace: true });
      }
    });
    return () => {
      active = false;
    };
  }, [navigate]);

  return (
    <div className="mobile-auth-shell">
      <main className="mobile-auth-card" aria-labelledby="welcome-title">
        <a href="/" className="mobile-auth-logo" aria-label="Habuks Home">
          <img src="/assets/logo.png" alt="Habuks" />
        </a>
        <h1 id="welcome-title" className="mobile-auth-title">
          Manage your organization workspace
        </h1>
        <p className="mobile-auth-subtitle">
          Track projects, members, finances, and documents in one place.
        </p>
        <div className="mobile-auth-actions">
          <Link to="/login" className="mobile-auth-btn mobile-auth-btn--primary">
            Sign In
          </Link>
          <Link to="/signup" className="mobile-auth-btn mobile-auth-btn--secondary">
            Create Organization
          </Link>
        </div>
        <p className="mobile-auth-meta">
          <Link to="/invite">Join with invite</Link>
        </p>
      </main>
    </div>
  );
}
