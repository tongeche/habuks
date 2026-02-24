import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, isSupabaseConfigured } from "../lib/supabase.js";
import { getCurrentMember, getTenantMemberships, resetSupabaseFallback } from "../lib/dataService.js";

export default function LoginPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

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

        const memberships = await getTenantMemberships(member.id);

        if (memberships.length === 1 && memberships[0]?.tenant?.slug) {
          const slug = memberships[0].tenant.slug;
          localStorage.setItem("lastTenantSlug", slug);
          navigate(`/tenant/${slug}/dashboard`);
          return;
        }

        if (memberships.length > 1) {
          const lastSlug = localStorage.getItem("lastTenantSlug");
          const match = memberships.find((m) => m.tenant?.slug === lastSlug);
          if (match?.tenant?.slug) {
            navigate(`/tenant/${match.tenant.slug}/dashboard`);
            return;
          }
          navigate("/select-tenant");
          return;
        }

        // No memberships — attempt owner self-join using the last known workspace.
        // "Tenant owner can self-join" RLS policy allows this when the tenant's
        // contact_email matches the signed-in user's JWT email (migration_050).
        const lastSlug = localStorage.getItem("lastTenantSlug");
        if (lastSlug) {
          try {
            const { data: tenant } = await supabase
              .from("tenants")
              .select("id, slug")
              .eq("slug", lastSlug)
              .maybeSingle();

            if (tenant?.id) {
              const { data: newMembership, error: joinError } = await supabase
                .from("tenant_members")
                .insert({ tenant_id: tenant.id, member_id: member.id, role: "admin", status: "active" })
                .select()
                .single();

              if (newMembership && !joinError) {
                navigate(`/tenant/${tenant.slug}/dashboard`);
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
            Have a workspace invite? <a href="/register">Create an account</a>
          </p>
          <a href="/" className="auth-back">← Back to Habuks</a>
        </div>
      </div>
    </div>
  );
}
