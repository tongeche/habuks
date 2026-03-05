import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase, isSupabaseConfigured } from "../lib/supabase.js";
import {
  getCurrentMember,
  getTenantById,
  getTenantMemberships,
  recoverMagicLinkTenantMembership,
  resetSupabaseFallback,
} from "../lib/dataService.js";

const getStoredDashboardPath = () => {
  if (typeof window === "undefined") return "/dashboard";
  const slug = String(window.localStorage.getItem("lastTenantSlug") || "")
    .trim()
    .toLowerCase();
  return slug ? `/tenant/${slug}/dashboard` : "/dashboard";
};

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
          navigate("/signup");
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
            // ignore — fall through to /signup
          }
        }

        // No workspace found — send to workspace creation
        navigate("/signup");
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
    <div className="mobile-auth-shell">
      <main className="mobile-auth-card" aria-labelledby="login-title">
        <h1 id="login-title" className="mobile-auth-title">
          Sign In
        </h1>
        <form onSubmit={handleSubmit} className="mobile-auth-form">
          <label className="mobile-auth-field">
            <span>Email</span>
            <input
              id="email"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              autoComplete="email"
            />
          </label>
          <label className="mobile-auth-field">
            <span>Password</span>
            <input
              id="password"
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              autoComplete="current-password"
            />
          </label>
          {error ? <p className="mobile-auth-error">{error}</p> : null}
          {message ? <p className="mobile-auth-message">{message}</p> : null}
          <button type="submit" className="mobile-auth-btn mobile-auth-btn--primary" disabled={loading}>
            {loading ? "Please wait..." : "Sign In"}
          </button>
        </form>
        <p className="mobile-auth-meta">
          <Link to="/reset-password">Forgot password</Link>
        </p>
        <p className="mobile-auth-meta">
          <Link to="/signup">Create organization</Link>
        </p>
        <p className="mobile-auth-meta">
          <Link to="/invite">Join with invite</Link>
        </p>
        <p className="mobile-auth-meta">
          <Link to="/welcome">← Back</Link>
        </p>
      </main>
    </div>
  );
}
