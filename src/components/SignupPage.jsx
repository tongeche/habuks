import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase, isSupabaseConfigured } from "../lib/supabase.js";
import { createTenant, createTenantMembership } from "../lib/dataService.js";

const slugify = (value) =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const inferNameFromEmail = (email, fallback = "Admin") => {
  const localPart = String(email || "").split("@")[0] || "";
  const parsed = localPart.replace(/[._-]+/g, " ").trim();
  return parsed || fallback;
};

const createTenantWithRetry = async (payload) => {
  const baseSlug = slugify(payload?.name);
  if (!baseSlug) {
    throw new Error("Organization name is required.");
  }

  let lastError = null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const randomSuffix = Math.floor(Math.random() * 9000) + 1000;
    const slug = attempt === 0 ? baseSlug : `${baseSlug}-${randomSuffix}`;
    try {
      const created = await createTenant({ ...payload, slug });
      if (created) {
        return created;
      }
    } catch (error) {
      lastError = error;
      if (String(error?.code || "") !== "TENANT_SLUG_TAKEN") {
        throw error;
      }
    }
  }

  throw lastError || new Error("Unable to create organization.");
};

const getStoredDashboardPath = () => {
  if (typeof window === "undefined") return "/dashboard";
  const slug = String(window.localStorage.getItem("lastTenantSlug") || "")
    .trim()
    .toLowerCase();
  return slug ? `/tenant/${slug}/dashboard` : "/dashboard";
};

export default function SignupPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [dashboardPath, setDashboardPath] = useState("/dashboard");
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    password: "",
    organization_name: "",
    organization_type: "",
    country: "",
    default_currency: "USD",
  });

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

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((previous) => ({ ...previous, [name]: value }));
    setError("");
    setMessage("");
  };

  const handleAccountContinue = (event) => {
    event.preventDefault();
    setError("");

    const fullName = formData.full_name.trim();
    const email = formData.email.trim();
    const password = formData.password;

    if (!fullName || !email || !password) {
      setError("Full name, email, and password are required.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setStep(2);
  };

  const handleOrganizationSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      if (!isSupabaseConfigured || !supabase) {
        setError("Supabase is not configured. Update your .env values and restart.");
        return;
      }

      const fullName = formData.full_name.trim();
      const email = formData.email.trim().toLowerCase();
      const password = formData.password;
      const organizationName = formData.organization_name.trim();
      const organizationType = formData.organization_type.trim();
      const country = formData.country.trim();
      const defaultCurrency = String(formData.default_currency || "USD").trim().toUpperCase();

      if (!organizationName || !organizationType || !country || !defaultCurrency) {
        setError("Organization name, type, country, and currency are required.");
        return;
      }

      if (password.length < 8) {
        setError("Password must be at least 8 characters.");
        return;
      }

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: fullName,
            role: "admin",
            organization_name: organizationName,
            organization_type: organizationType,
          },
        },
      });

      if (signUpError) {
        setError(signUpError.message || "Unable to create account.");
        return;
      }

      const authUserId = signUpData?.user?.id;
      if (!authUserId) {
        setError("Signup completed but user information is missing.");
        return;
      }

      if (!signUpData?.session) {
        setStep(3);
        setMessage(
          "Account created. Confirm your email, then sign in to finish organization setup."
        );
        setDashboardPath("/login");
        return;
      }

      const memberPayload = {
        name: fullName || inferNameFromEmail(email, organizationName),
        email,
        phone_number: null,
        role: "member",
        status: "active",
        join_date: new Date().toISOString().slice(0, 10),
        auth_id: authUserId,
        password_hash: "auth_managed",
      };

      let memberId = null;
      const { data: createdMember, error: createMemberError } = await supabase
        .from("members")
        .insert(memberPayload)
        .select("id")
        .single();

      if (createdMember?.id) {
        memberId = createdMember.id;
      } else if (String(createMemberError?.code || "") === "23505") {
        const { data: linkedMember, error: linkError } = await supabase
          .from("members")
          .update({ auth_id: authUserId, name: memberPayload.name })
          .ilike("email", email)
          .select("id")
          .maybeSingle();
        if (linkError) {
          setError(linkError.message || "Unable to link your member profile.");
          return;
        }
        memberId = linkedMember?.id || null;
      } else if (createMemberError) {
        setError(createMemberError.message || "Unable to create your member profile.");
        return;
      }

      if (!memberId) {
        setError("Unable to create your member profile.");
        return;
      }

      const tenant = await createTenantWithRetry({
        name: organizationName,
        currency_code: defaultCurrency,
        tagline: organizationType,
        location: country,
        contact_email: email,
        site_data: {
          orgName: organizationName,
          organizationType,
          country,
        },
      });

      if (!tenant?.id) {
        setError("Organization created without a valid workspace ID.");
        return;
      }

      try {
        await createTenantMembership({
          tenantId: tenant.id,
          memberId,
          role: "admin",
        });
      } catch (membershipError) {
        if (String(membershipError?.code || "") !== "23505") {
          console.warn("Signup: tenant membership setup warning:", membershipError);
        }
      }

      const tenantSlug = String(tenant?.slug || "").trim().toLowerCase();
      if (tenantSlug && typeof window !== "undefined") {
        window.localStorage.setItem("lastTenantSlug", tenantSlug);
      }

      setDashboardPath(tenantSlug ? `/tenant/${tenantSlug}/dashboard` : "/dashboard");
      setMessage("Your organization workspace is ready.");
      setStep(3);
    } catch (submitError) {
      setError(submitError?.message || "Unable to complete signup right now.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mobile-auth-shell">
      <main className="mobile-auth-card" aria-labelledby="signup-title">
        <h1 id="signup-title" className="mobile-auth-title">
          Create Organization
        </h1>
        {step === 1 ? (
          <form className="mobile-auth-form" onSubmit={handleAccountContinue}>
            <label className="mobile-auth-field">
              <span>Full name</span>
              <input
                type="text"
                name="full_name"
                value={formData.full_name}
                onChange={handleChange}
                autoComplete="name"
                required
              />
            </label>
            <label className="mobile-auth-field">
              <span>Email</span>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                autoComplete="email"
                required
              />
            </label>
            <label className="mobile-auth-field">
              <span>Password</span>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                autoComplete="new-password"
                required
              />
            </label>
            {error ? <p className="mobile-auth-error">{error}</p> : null}
            <button type="submit" className="mobile-auth-btn mobile-auth-btn--primary">
              Continue
            </button>
          </form>
        ) : null}

        {step === 2 ? (
          <form className="mobile-auth-form" onSubmit={handleOrganizationSubmit}>
            <label className="mobile-auth-field">
              <span>Organization name</span>
              <input
                type="text"
                name="organization_name"
                value={formData.organization_name}
                onChange={handleChange}
                autoComplete="organization"
                required
              />
            </label>
            <label className="mobile-auth-field">
              <span>Organization type</span>
              <input
                type="text"
                name="organization_type"
                value={formData.organization_type}
                onChange={handleChange}
                required
              />
            </label>
            <label className="mobile-auth-field">
              <span>Country</span>
              <input
                type="text"
                name="country"
                value={formData.country}
                onChange={handleChange}
                autoComplete="country-name"
                required
              />
            </label>
            <label className="mobile-auth-field">
              <span>Default currency</span>
              <select
                name="default_currency"
                value={formData.default_currency}
                onChange={handleChange}
                required
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="KES">KES</option>
                <option value="NGN">NGN</option>
              </select>
            </label>
            {error ? <p className="mobile-auth-error">{error}</p> : null}
            {message ? <p className="mobile-auth-message">{message}</p> : null}
            <button
              type="submit"
              className="mobile-auth-btn mobile-auth-btn--primary"
              disabled={loading}
            >
              {loading ? "Please wait..." : "Continue"}
            </button>
            <button
              type="button"
              className="mobile-auth-btn mobile-auth-btn--secondary"
              onClick={() => setStep(1)}
              disabled={loading}
            >
              Back
            </button>
          </form>
        ) : null}

        {step === 3 ? (
          <div className="mobile-auth-form">
            <p className="mobile-auth-message">
              {message || "Your organization workspace is ready."}
            </p>
            <button
              type="button"
              className="mobile-auth-btn mobile-auth-btn--primary"
              onClick={() => navigate(dashboardPath)}
            >
              Go to dashboard
            </button>
          </div>
        ) : null}

        <p className="mobile-auth-meta">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
        <p className="mobile-auth-meta">
          <Link to="/welcome">← Back</Link>
        </p>
      </main>
    </div>
  );
}
