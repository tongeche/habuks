import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase, isSupabaseConfigured } from "../lib/supabase.js";
import {
  getCurrentMember,
  getTenantById,
  getTenantMemberships,
  recoverMagicLinkTenantMembership,
  resetSupabaseFallback,
} from "../lib/dataService.js";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search || "");
    const workspace = String(params.get("workspace") || params.get("tenant") || "").trim().toLowerCase();
    if (!workspace) return;
    localStorage.setItem("lastTenantSlug", workspace);
    localStorage.setItem("pendingInviteTenantSlug", workspace);
  }, [location.search]);

  const redirectToTenantDashboard = (slug) => {
    const cleanSlug = String(slug || "").trim().toLowerCase();
    if (!cleanSlug) return false;
    localStorage.setItem("lastTenantSlug", cleanSlug);
    localStorage.removeItem("pendingInviteTenantSlug");
    navigate(`/tenant/${cleanSlug}/dashboard`);
    return true;
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setMessage("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      if (!isSupabaseConfigured || !supabase) {
        setError("Supabase is not configured. Update your .env values and restart.");
        return;
      }

      const email = formData.email.trim();
      const password = formData.password;

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
        return;
      }

      // Successful sign-in — reset dev-mode fallback so queries work
      resetSupabaseFallback();

      // Resolve destination based on tenant memberships
      try {
        const member = await getCurrentMember();
        if (!member) {
          navigate("/get-started");
          return;
        }

        const pendingInviteSlug = localStorage.getItem("pendingInviteTenantSlug");
        const lastSlug = localStorage.getItem("lastTenantSlug");
        const preferredSlug = pendingInviteSlug || lastSlug || null;

        // Run invite membership recovery first so invited users are routed
        // to workspace dashboard immediately after first login.
        try {
          const recovered = await recoverMagicLinkTenantMembership(member.id, preferredSlug);
          if (recovered?.tenant_slug && redirectToTenantDashboard(recovered.tenant_slug)) {
            return;
          }
        } catch (recoverError) {
          console.warn("Login: invite membership recovery failed:", recoverError);
        }

        const memberships = await getTenantMemberships(member.id);
        const membershipsWithTenantSlug = memberships.filter((membership) => membership?.tenant?.slug);

        if (membershipsWithTenantSlug.length === 1) {
          const slug = membershipsWithTenantSlug[0].tenant.slug;
          redirectToTenantDashboard(slug);
          return;
        }

        if (membershipsWithTenantSlug.length > 1) {
          const match = membershipsWithTenantSlug.find(
            (m) => m.tenant?.slug === preferredSlug
          );
          if (match?.tenant?.slug) {
            redirectToTenantDashboard(match.tenant.slug);
            return;
          }
          navigate("/select-tenant");
          return;
        }

        // Membership exists but tenant relation is not fully resolvable under current policies.
        // Do not send the user to workspace creation in this case.
        if (memberships.length > 0) {
          if (preferredSlug && redirectToTenantDashboard(preferredSlug)) {
            return;
          }

          for (const membership of memberships) {
            if (!membership?.tenant_id) continue;
            const tenant = await getTenantById(membership.tenant_id);
            if (tenant?.slug && redirectToTenantDashboard(tenant.slug)) {
              return;
            }
          }

          navigate("/select-tenant");
          return;
        }

        // No memberships yet — recover invite-based membership (non-admin invitees).
        try {
          const recovered = await recoverMagicLinkTenantMembership(member.id, null);
          if (recovered?.tenant_slug && redirectToTenantDashboard(recovered.tenant_slug)) {
            return;
          }
        } catch (recoverError) {
          console.warn("Login: invite membership recovery failed:", recoverError);
        }

        // No memberships — attempt owner self-join using the last known workspace.
        // "Tenant owner can self-join" RLS policy allows this when the tenant's
        // contact_email matches the signed-in user's JWT email (migration_050).
        if (preferredSlug) {
          try {
            const { data: tenant } = await supabase
              .from("tenants")
              .select("id, slug")
              .eq("slug", preferredSlug)
              .maybeSingle();

            if (tenant?.id) {
              const { data: newMembership, error: joinError } = await supabase
                .from("tenant_members")
                .insert({ tenant_id: tenant.id, member_id: member.id, role: "admin", status: "active" })
                .select()
                .single();

              if (newMembership && !joinError && redirectToTenantDashboard(tenant.slug)) {
                return;
              }
            }
          } catch (_) {
            // ignore — fall through to /get-started
          }
        }

        // No workspace found — send to workspace creation
        navigate("/get-started");
        return;
      } catch (resolveErr) {
        console.warn("Login: could not resolve tenant, falling back:", resolveErr);
        navigate("/select-tenant");
        return;
      }
    } catch (err) {
      setError(err?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page auth-page--single">
      <div className="auth-form-col">
        <div className="auth-form-inner">
          <a href="/" className="auth-logo">
            <img src="/assets/logo.png" alt="Habuks" />
          </a>
          <h1>Sign in to Habuks</h1>
          <p className="auth-note">
            Use your workspace credentials to access your tenant dashboard.
          </p>
          <div className="auth-paths">
            <a className="auth-path-card" href="/get-started">
              <strong>Start free trial</strong>
              <span>Create a new workspace as admin.</span>
            </a>
            <a className="auth-path-card" href="/register">
              <strong>Join with invite</strong>
              <span>Use invite number/code from your workspace admin.</span>
            </a>
          </div>
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="auth-field">
              <label htmlFor="email">E-mail</label>
              <input
                id="email"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                autoComplete="email"
              />
            </div>
            <div className="auth-field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                autoComplete="current-password"
              />
            </div>
            {error && <p className="auth-error">{error}</p>}
            {message && <p className="auth-message">{message}</p>}
            <button type="submit" className="auth-btn auth-btn-centered" disabled={loading}>
              {loading ? "Please wait..." : "Sign In"}
            </button>
          </form>
          <p className="register-login-link">
            Have a workspace invite? <a href="/register">Create account with invite</a>
          </p>
          <a href="/" className="auth-back">← Back to Habuks</a>
        </div>
      </div>
    </div>
  );
}
