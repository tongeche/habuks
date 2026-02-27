import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import SiteHeader from "./SiteHeader.jsx";
import SiteFooter from "./SiteFooter.jsx";
import { supabase, isSupabaseConfigured } from "../lib/supabase.js";
import { createTenant } from "../lib/dataService.js";

const getLandingData = () => {
  if (typeof window !== "undefined" && window.landingData) {
    return window.landingData();
  }
  return {};
};

const slugify = (value) =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export default function TenantSignupPage() {
  const data = useMemo(getLandingData, []);
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    admin_email: "",
    admin_password: "",
  });
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  // Track whether the user already has an active session
  const [existingUser, setExistingUser] = useState(null);
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setSessionChecked(true);
      return;
    }
    supabase.auth.getSession().then(({ data: sd }) => {
      setExistingUser(sd?.session?.user || null);
      setSessionChecked(true);
    });
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setError("");
    setMessage("");

    if (name === "name") {
      setFormData((prev) => ({
        ...prev,
        name: value,
        slug: slugTouched ? prev.slug : slugify(value),
      }));
      return;
    }

    if (name === "slug") {
      setSlugTouched(true);
      setFormData((prev) => ({ ...prev, slug: slugify(value) }));
      return;
    }

    setFormData((prev) => ({ ...prev, [name]: value }));
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

      const name = formData.name.trim();
      const slug = slugify(formData.slug);

      if (!name || !slug) {
        setError("Organization name and workspace name are required.");
        return;
      }

      // ── Step 1: Establish auth session ───────────────────────────────────
      // If the user is already signed in, reuse their session.
      // Otherwise sign up first so every subsequent DB operation has a valid JWT.
      let authUserId = existingUser?.id || null;
      let adminEmail = existingUser?.email || formData.admin_email.trim();
      const adminPassword = formData.admin_password;

      if (!authUserId) {
        if (!adminEmail || !adminPassword) {
          setError("Admin email and password are required.");
          return;
        }
        if (adminPassword.length < 6) {
          setError("Password must be at least 6 characters.");
          return;
        }

        const rawName = adminEmail.split("@")[0] || "";
        const adminName =
          rawName.replace(/[._-]+/g, " ").trim() || (name ? `${name} Admin` : "Admin");

        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: adminEmail,
          password: adminPassword,
          options: { data: { name: adminName, role: "admin" } },
        });

        if (signUpError) {
          setError(signUpError.message);
          return;
        }

        if (!signUpData?.session) {
          // Email confirmation required — ask user to confirm then log in
          setMessage(
            "Account created. Please check your email to confirm, then sign in to set up your workspace.",
          );
          window.setTimeout(() => navigate("/login"), 1500);
          return;
        }

        authUserId = signUpData.user.id;
        adminEmail = signUpData.user.email || adminEmail;
      }

      // ── Step 2: Create or link member row ────────────────────────────────
      const rawName = adminEmail.split("@")[0] || "";
      const adminName =
        rawName.replace(/[._-]+/g, " ").trim() || (name ? `${name} Admin` : "Admin");

      let memberId = null;

      const { data: createdMember, error: memberError } = await supabase
        .from("members")
        .insert({
          name: adminName,
          email: adminEmail,
          phone_number: null,
          role: "member",
          status: "active",
          join_date: new Date().toISOString().slice(0, 10),
          auth_id: authUserId,
          password_hash: "auth_managed",
        })
        .select()
        .single();

      if (createdMember?.id) {
        memberId = createdMember.id;
      } else {
        // Duplicate email — link existing member row by email
        const { data: linked } = await supabase
          .from("members")
          .update({ auth_id: authUserId })
          .ilike("email", adminEmail)
          .is("auth_id", null)
          .select("id")
          .single();
        memberId = linked?.id || null;

        // Last resort: already linked — fetch by auth_id
        if (!memberId) {
          const { data: existing } = await supabase
            .from("members")
            .select("id")
            .eq("auth_id", authUserId)
            .maybeSingle();
          memberId = existing?.id || null;
        }
      }

      if (!memberId) {
        setError("Unable to create your member profile. Please try again.");
        return;
      }

      // ── Step 3: Create tenant ─────────────────────────────────────────────
      // contact_email = adminEmail so "Tenant owner can self-join" RLS passes
      const tenant = await createTenant({
        name,
        slug,
        tagline: "",
        contact_email: adminEmail,
        contact_phone: null,
        location: null,
        logo_url: null,
        site_data: { orgName: name, orgTagline: "Community operations hub" },
      });

      // ── Step 4: Create tenant membership ─────────────────────────────────
      // Works via "Bootstrap tenant admin" (first member) OR
      // "Tenant owner can self-join" (contact_email matches JWT) — both now
      // use SECURITY DEFINER helpers so no RLS recursion (migration_050)
      const { error: membershipError } = await supabase
        .from("tenant_members")
        .insert({ tenant_id: tenant.id, member_id: memberId, role: "admin", status: "active" });

      if (membershipError && membershipError.code !== "23505") {
        console.error("Signup: tenant_members insert failed:", membershipError);
        // Non-fatal: user is in the workspace, can still log in and see the tenant
        // if they are the owner (contact_email matches)
      }

      const nextSlug = tenant?.slug || slug;
      localStorage.setItem("lastTenantSlug", nextSlug);
      navigate(`/tenant/${nextSlug}/dashboard`);
    } catch (err) {
      const msg = err?.message || "Unable to create workspace. Please try again.";
      if (err?.code === "TENANT_NAME_TAKEN") {
        setError("That workspace/company name is already in use. Please pick another.");
      } else if (err?.code === "TENANT_SLUG_TAKEN") {
        setError("That workspace name is already in use. Please pick another workspace name.");
      } else if (err?.code === "TENANT_NAME_INVALID") {
        setError("Workspace name cannot be blank.");
      } else if (msg.toLowerCase().includes("duplicate")) {
        setError("That workspace name is already in use. Please pick another.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-shell tenant-signup-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <SiteHeader data={data} hideTopBar />
      <main id="main" className="page-body tenant-signup-page">
        <section className="tenant-signup-hero">
          <div className="container tenant-signup-hero-inner">
            <div className="tenant-signup-copy">
              <p className="landing-kicker">GET STARTED</p>
              <h1>Create your Habuks workspace</h1>
              <p className="landing-description">
                Set up a tenant workspace in minutes. After signup you will log in to finish onboarding
                and tailor your branding, modules, and navigation.
              </p>
              <ul className="tenant-signup-list">
                <li>Separate data per tenant</li>
                <li>Role-based access controls</li>
                <li>Audit-ready operations tracking</li>
              </ul>
            </div>
            <div className="tenant-signup-card">
              <h2>Workspace details</h2>
              {sessionChecked && existingUser ? (
                <p className="tenant-helper">
                  Signed in as <strong>{existingUser.email}</strong>. Just fill in your workspace
                  details below.
                </p>
              ) : (
                <p className="tenant-helper">
                  Joining with invite number/code? Use <a href="/register">/register</a> instead.
                </p>
              )}
              <form onSubmit={handleSubmit} className="tenant-signup-form">
                <div className="tenant-field">
                  <label htmlFor="name">Organization name</label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    autoComplete="organization"
                    placeholder="Bangu Youth Group"
                  />
                </div>
                <div className="tenant-field">
                  <label htmlFor="slug">Workspace name</label>
                  <input
                    id="slug"
                    name="slug"
                    type="text"
                    value={formData.slug}
                    onChange={handleChange}
                    required
                    autoComplete="off"
                    placeholder="bangu-youth"
                  />
                </div>

                {/* Only ask for credentials if no active session */}
                {sessionChecked && !existingUser ? (
                  <>
                    <div className="tenant-field">
                      <label htmlFor="admin_email">Email address</label>
                      <input
                        id="admin_email"
                        name="admin_email"
                        type="email"
                        value={formData.admin_email}
                        onChange={handleChange}
                        required
                        autoComplete="email"
                        placeholder="admin@banguyouth.org"
                      />
                    </div>
                    <div className="tenant-field">
                      <label htmlFor="admin_password">Password</label>
                      <input
                        id="admin_password"
                        name="admin_password"
                        type="password"
                        value={formData.admin_password}
                        onChange={handleChange}
                        required
                        autoComplete="new-password"
                        placeholder="At least 6 characters"
                      />
                    </div>
                  </>
                ) : null}

                {error ? <p className="tenant-error">{error}</p> : null}
                {message ? <p className="tenant-message">{message}</p> : null}

                <div className="tenant-step-actions">
                  <button type="submit" className="btn btn-primary" disabled={loading || !sessionChecked}>
                    {loading ? "Creating workspace..." : "Create workspace"}
                  </button>
                </div>

                <p className="tenant-helper">
                  Already have a workspace? <a href="/login">Sign in here</a>.
                </p>
              </form>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter data={data} />
    </div>
  );
}
