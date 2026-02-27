import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { supabase, isSupabaseConfigured } from "../lib/supabase.js";
import {
  applyMagicLinkInviteProjectAccess,
  createTenantMembership,
  findInviteSignupTenants,
  getTenantById,
  markMagicLinkInviteUsed,
  markInviteUsed,
  recoverMagicLinkTenantMembership,
  verifyMagicLinkInvite,
  verifyMemberInvite,
} from "../lib/dataService.js";

const normalizePhone = (value) => String(value || "").replace(/\s+/g, "");
const normalizeInviteToken = (value) => String(value || "").trim().replace(/\s+/g, "");
const isNumericInviteToken = (value) => /^\d{6,10}$/.test(normalizeInviteToken(value));

const normalizeWorkspaceName = (value) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

const toWorkspaceSlug = (value) =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const inferNameFromEmail = (email, fallback = "Member") => {
  const localPart = String(email || "").split("@")[0] || "";
  const parsed = localPart.replace(/[._-]+/g, " ").trim();
  return parsed || fallback;
};

// Password strength calculator
const getPasswordStrength = (password) => {
  if (!password) return { score: 0, label: "", color: "" };
  let score = 0;
  if (password.length >= 6) score += 1;
  if (password.length >= 8) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^a-zA-Z0-9]/.test(password)) score += 1;

  if (score <= 1) return { score: 1, label: "Weak password", color: "#ef4444" };
  if (score <= 2) return { score: 2, label: "Fair password", color: "#f59e0b" };
  if (score <= 3) return { score: 3, label: "Good password", color: "#10b981" };
  return { score: 4, label: "Strong password", color: "#059669" };
};

export default function RegisterPage() {
  const location = useLocation();
  const [formData, setFormData] = useState({
    workspace_name: "",
    full_name: "",
    email: "",
    phone_number: "",
    password: "",
    invite_code: "",
  });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [tenantSlug, setTenantSlug] = useState("");
  const [step, setStep] = useState(1);
  const [workspaceMatches, setWorkspaceMatches] = useState([]);
  const [verifiedInviteState, setVerifiedInviteState] = useState(null);

  const passwordStrength = useMemo(
    () => getPasswordStrength(formData.password),
    [formData.password]
  );

  const canGoBack = step > 1 && !loading;

  useEffect(() => {
    const params = new URLSearchParams(location.search || "");
    const inviteToken = normalizeInviteToken(
      params.get("invite") || params.get("code") || params.get("invite_number")
    );
    const emailParam = String(params.get("email") || "").trim();
    const workspaceParam = String(
      params.get("workspace") || params.get("tenant") || params.get("organization") || ""
    ).trim();

    setFormData((prev) => ({
      ...prev,
      invite_code: inviteToken || prev.invite_code,
      email: emailParam || prev.email,
      workspace_name: workspaceParam || prev.workspace_name,
    }));

    if (workspaceParam && inviteToken) {
      setStep(2);
    }
  }, [location.search]);

  const resetStepProgress = (targetStep = 1) => {
    setStep(targetStep);
    setWorkspaceMatches([]);
    setVerifiedInviteState(null);
    setTenantSlug("");
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({ ...prev, [name]: value }));
    setError("");
    setMessage("");

    if (name === "workspace_name") {
      if (step > 1 || workspaceMatches.length || verifiedInviteState) {
        resetStepProgress(1);
      }
      return;
    }

    if (name === "email" || name === "invite_code") {
      if (verifiedInviteState) {
        setVerifiedInviteState(null);
      }
    }
  };

  const verifyInviteToken = async (inviteCode) => {
    const attemptOrder = isNumericInviteToken(inviteCode)
      ? [
          { kind: "magic", verify: verifyMagicLinkInvite },
          { kind: "member", verify: verifyMemberInvite },
        ]
      : [
          { kind: "member", verify: verifyMemberInvite },
          { kind: "magic", verify: verifyMagicLinkInvite },
        ];

    let invite = null;
    let inviteKind = "";
    let lastVerifyError = null;

    for (const attempt of attemptOrder) {
      try {
        const verified = await attempt.verify(inviteCode);
        if (verified) {
          invite = verified;
          inviteKind = attempt.kind;
          break;
        }
      } catch (verifyError) {
        lastVerifyError = verifyError;
      }
    }

    if (!invite) {
      throw lastVerifyError || new Error("Invalid or expired invite.");
    }

    return { invite, inviteKind };
  };

  const handleWorkspaceContinue = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      if (!isSupabaseConfigured || !supabase) {
        setError("Supabase is not configured. Update your .env values and restart.");
        return;
      }

      const workspaceName = formData.workspace_name.trim();
      if (!workspaceName) {
        setError("Enter your company/workspace name first.");
        return;
      }

      const matches = await findInviteSignupTenants(workspaceName);
      if (!Array.isArray(matches) || matches.length === 0) {
        setError("Workspace not found. Confirm the exact company/workspace name with your admin.");
        return;
      }

      setWorkspaceMatches(matches);
      setStep(2);
      if (matches[0]?.slug) {
        setTenantSlug(matches[0].slug);
      }

      if (matches.length > 1) {
        setMessage("Workspace found. Multiple matches exist; your invite code will select the exact workspace.");
      } else {
        setMessage(`Workspace found: ${matches[0].name}. Continue with email and invite.`);
      }
    } catch (err) {
      setError(err?.message || "Unable to verify workspace right now. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleInviteContinue = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      if (!isSupabaseConfigured || !supabase) {
        setError("Supabase is not configured. Update your .env values and restart.");
        return;
      }

      const workspaceName = formData.workspace_name.trim();
      const email = formData.email.trim();
      const inviteCode = normalizeInviteToken(formData.invite_code);

      if (!workspaceName) {
        setError("Please confirm your workspace/company name first.");
        setStep(1);
        return;
      }
      if (!email || !inviteCode) {
        setError("Email and invite code are required.");
        return;
      }

      let matches = workspaceMatches;
      if (!Array.isArray(matches) || matches.length === 0) {
        matches = await findInviteSignupTenants(workspaceName);
        setWorkspaceMatches(matches || []);
      }

      if (!matches || matches.length === 0) {
        setError("Workspace not found. Go back and confirm the workspace/company name.");
        setStep(1);
        return;
      }

      const { invite, inviteKind } = await verifyInviteToken(inviteCode);

      if (!invite.tenant_id) {
        setError("This invite is not linked to a tenant workspace.");
        return;
      }

      const tenant = await getTenantById(invite.tenant_id);
      if (!tenant) {
        setError("This invite is linked to a workspace that no longer exists.");
        return;
      }

      const normalizedTypedWorkspace = normalizeWorkspaceName(workspaceName);
      const normalizedTypedSlug = toWorkspaceSlug(workspaceName);
      const normalizedTenantName = normalizeWorkspaceName(tenant?.name);
      const normalizedTenantSlug = String(tenant?.slug || "").trim().toLowerCase();
      const matchingWorkspace = (matches || []).some((candidate) => String(candidate?.id || "") === String(tenant.id));

      if (
        !matchingWorkspace &&
        normalizedTypedWorkspace !== normalizedTenantName &&
        normalizedTypedSlug !== normalizedTenantSlug
      ) {
        setError(
          `Invite belongs to workspace \"${tenant?.name || normalizedTenantSlug || "unknown"}\". Confirm company name and retry.`
        );
        return;
      }

      if (invite.email && String(invite.email).toLowerCase() !== email.toLowerCase()) {
        setError("This invite code is linked to a different email address.");
        return;
      }

      setVerifiedInviteState({ invite, inviteKind, tenant });
      setTenantSlug(tenant?.slug || "");
      setFormData((prev) => ({
        ...prev,
        email: email,
        full_name: prev.full_name || inferNameFromEmail(email, tenant?.name || "Member"),
      }));
      setStep(3);
      setMessage("Invite verified. Set your password to complete account setup.");
    } catch (err) {
      setError(err?.message || "Could not verify invite. Please check and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAccount = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      if (!isSupabaseConfigured || !supabase) {
        setError("Supabase is not configured. Update your .env values and restart.");
        return;
      }

      if (!verifiedInviteState?.invite || !verifiedInviteState?.tenant) {
        setError("Invite verification expired. Please verify email and invite again.");
        setStep(2);
        return;
      }

      const { invite, inviteKind, tenant } = verifiedInviteState;
      const email = formData.email.trim();
      const password = formData.password;
      const phone = formData.phone_number.trim();
      const fullName = formData.full_name.trim() || inferNameFromEmail(email, tenant?.name || "Member");

      if (!email || !password) {
        setError("Email and password are required.");
        return;
      }

      if (password.length < 6) {
        setError("Password must be at least 6 characters.");
        return;
      }

      if (invite.email && String(invite.email).toLowerCase() !== email.toLowerCase()) {
        setError("This invite code is linked to a different email address.");
        setStep(2);
        return;
      }

      if (invite.phone_number) {
        const expectedPhone = normalizePhone(invite.phone_number);
        if (!phone) {
          setError("This invite is linked to a phone number. Enter that phone number to continue.");
          return;
        }
        if (expectedPhone && normalizePhone(phone) !== expectedPhone) {
          setError("This invite code is linked to a different phone number.");
          return;
        }
      }

      const profilePhone = phone || String(invite.phone_number || "").trim() || null;

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: fullName,
            phone_number: profilePhone,
            role: invite.role || "member",
          },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      const userId = signUpData?.user?.id;
      if (!userId) {
        setError("Signup succeeded but the user record is missing.");
        return;
      }

      const memberPayload = {
        name: fullName,
        email,
        phone_number: profilePhone,
        role: invite.role || "member",
        status: "active",
        join_date: new Date().toISOString().slice(0, 10),
        auth_id: userId,
        password_hash: "auth_managed",
      };

      const { data: createdMember, error: memberError } = await supabase
        .from("members")
        .insert(memberPayload)
        .select()
        .single();
      let memberId = createdMember?.id || null;

      if (memberError) {
        if (memberError.code === "23505") {
          const { data: linkedMember, error: updateError } = await supabase
            .from("members")
            .update({
              auth_id: userId,
              name: fullName,
              phone_number: profilePhone,
            })
            .eq("email", email)
            .select()
            .maybeSingle();

          if (updateError) {
            setError(updateError.message || "Unable to link member profile.");
            return;
          }
          if (linkedMember?.id) {
            memberId = linkedMember.id;
          } else {
            setError("This email is already linked to another account. Please sign in instead.");
            return;
          }
        } else {
          setError(memberError.message || "Unable to create member profile.");
          return;
        }
      }

      const membershipRole =
        String(invite.role || "").toLowerCase().includes("admin") ? "admin" : invite.role || "member";

      try {
        await createTenantMembership({
          tenantId: invite.tenant_id,
          memberId,
          role: membershipRole,
        });
      } catch (membershipError) {
        console.warn("Tenant membership pending:", membershipError);
      }

      if (tenant?.slug) {
        localStorage.setItem("lastTenantSlug", tenant.slug);
        localStorage.setItem("pendingInviteTenantSlug", tenant.slug);
      }

      try {
        await recoverMagicLinkTenantMembership(memberId, tenant?.slug || null);
      } catch (recoveryError) {
        console.warn("Tenant membership recovery pending:", recoveryError);
      }

      if (inviteKind === "magic") {
        try {
          await applyMagicLinkInviteProjectAccess(invite.id, memberId);
        } catch (projectAccessError) {
          console.warn("Project access assignment pending:", projectAccessError);
        }
      }

      try {
        if (inviteKind === "magic") {
          await markMagicLinkInviteUsed(invite.id, memberId);
        } else {
          await markInviteUsed(invite.id);
        }
      } catch (markError) {
        console.warn("Unable to mark invite used:", markError);
      }

      setSuccess(true);
      setTenantSlug(tenant?.slug || "");

      if (signUpData?.session) {
        setMessage("Account created. Sign in to continue directly to your workspace dashboard.");
      } else {
        setMessage("Account created. Check your email to confirm, then sign in to your workspace dashboard.");
      }
    } catch (err) {
      setError(err?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (!canGoBack) return;
    setError("");
    setMessage("");

    if (step === 3) {
      setStep(2);
      return;
    }

    if (step === 2) {
      resetStepProgress(1);
    }
  };

  const handleFormSubmit = (e) => {
    if (step === 1) {
      handleWorkspaceContinue(e);
      return;
    }
    if (step === 2) {
      handleInviteContinue(e);
      return;
    }
    handleCreateAccount(e);
  };

  const showPhoneField = Boolean(verifiedInviteState?.invite?.phone_number);

  return (
    <div className="register-page-v2">
      <div className="register-card-container">
        <div className="register-form-col">
          <div className="register-form-wrapper">
            {!success ? (
              <>
                <h1 className="register-heading">
                  Join your Habuks<br />workspace
                </h1>
                <p className="auth-note">
                  Invite flow: confirm workspace, verify invite, then set password.
                </p>

                <div className="register-step-pills" aria-label="Invite signup steps">
                  <span className={`register-step-pill${step >= 1 ? " is-active" : ""}`}>1. Workspace</span>
                  <span className={`register-step-pill${step >= 2 ? " is-active" : ""}`}>2. Invite</span>
                  <span className={`register-step-pill${step >= 3 ? " is-active" : ""}`}>3. Password</span>
                </div>

                <form onSubmit={handleFormSubmit} className="register-form">
                  {step === 1 ? (
                    <>
                      <div className="register-field">
                        <span className="register-field-icon">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 21h18" />
                            <path d="M5 21V7l7-4 7 4v14" />
                            <path d="M9 10h6" />
                            <path d="M9 14h6" />
                          </svg>
                        </span>
                        <input
                          id="workspace_name"
                          type="text"
                          name="workspace_name"
                          value={formData.workspace_name}
                          onChange={handleChange}
                          placeholder="Company/workspace name"
                          required
                          autoComplete="organization"
                        />
                      </div>
                      <p className="register-helper-note">
                        Enter the workspace name used by the admin who invited you.
                      </p>
                    </>
                  ) : null}

                  {step === 2 ? (
                    <>
                      <p className="register-helper-chip">
                        Workspace: <strong>{formData.workspace_name}</strong>
                      </p>
                      <div className="register-field">
                        <span className="register-field-icon">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="2" y="4" width="20" height="16" rx="2" />
                            <path d="M22 7l-10 6L2 7" />
                          </svg>
                        </span>
                        <input
                          id="email"
                          type="email"
                          name="email"
                          value={formData.email}
                          onChange={handleChange}
                          placeholder="Invite email"
                          required
                          autoComplete="email"
                        />
                      </div>

                      <div className="register-field register-field-invite">
                        <input
                          id="invite_code"
                          type="text"
                          name="invite_code"
                          value={formData.invite_code}
                          onChange={handleChange}
                          placeholder="Paste workspace invite code or number"
                          required
                          autoComplete="one-time-code"
                        />
                      </div>

                      <p className="register-helper-note">
                        We will verify that your invite belongs to this workspace before account setup.
                      </p>
                    </>
                  ) : null}

                  {step === 3 ? (
                    <>
                      <p className="register-helper-chip">
                        Verified workspace: <strong>{verifiedInviteState?.tenant?.name || formData.workspace_name}</strong>
                      </p>
                      <div className="register-field">
                        <span className="register-field-icon">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                          </svg>
                        </span>
                        <input
                          id="full_name"
                          type="text"
                          name="full_name"
                          value={formData.full_name}
                          onChange={handleChange}
                          placeholder="Full name"
                          autoComplete="name"
                        />
                      </div>

                      <div className="register-field">
                        <span className="register-field-icon">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="2" y="4" width="20" height="16" rx="2" />
                            <path d="M22 7l-10 6L2 7" />
                          </svg>
                        </span>
                        <input
                          id="email-confirm"
                          type="email"
                          name="email"
                          value={formData.email}
                          onChange={handleChange}
                          placeholder="Invite email"
                          required
                          autoComplete="email"
                        />
                      </div>

                      {showPhoneField ? (
                        <div className="register-field register-field-phone">
                          <span className="register-phone-code">Phone</span>
                          <span className="register-phone-divider">|</span>
                          <input
                            id="phone_number"
                            type="tel"
                            name="phone_number"
                            value={formData.phone_number}
                            onChange={handleChange}
                            placeholder="Enter invite phone number"
                            required
                            autoComplete="tel"
                          />
                        </div>
                      ) : null}

                      <div className="register-field">
                        <span className="register-field-icon">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                          </svg>
                        </span>
                        <input
                          id="password"
                          type="password"
                          name="password"
                          value={formData.password}
                          onChange={handleChange}
                          placeholder="Create password"
                          required
                          autoComplete="new-password"
                        />
                      </div>

                      {formData.password ? (
                        <div className="register-password-strength">
                          <span className="register-strength-label" style={{ color: passwordStrength.color }}>
                            {passwordStrength.label}
                          </span>
                          <div className="register-strength-bar">
                            <div
                              className="register-strength-fill"
                              style={{
                                width: `${(passwordStrength.score / 4) * 100}%`,
                                background: passwordStrength.color,
                              }}
                            />
                          </div>
                        </div>
                      ) : null}
                    </>
                  ) : null}

                  {error ? <p className="register-error">{error}</p> : null}
                  {message ? <p className="register-message">{message}</p> : null}

                  <div className="register-inline-actions">
                    {canGoBack ? (
                      <button
                        type="button"
                        className="register-secondary-btn register-back-btn"
                        onClick={handleBack}
                        disabled={loading}
                      >
                        Back
                      </button>
                    ) : null}
                    <button type="submit" className="register-submit-btn" disabled={loading}>
                      {loading
                        ? "Please wait..."
                        : step === 1
                          ? "Find workspace"
                          : step === 2
                            ? "Verify invite"
                            : "Create account"}
                    </button>
                  </div>
                </form>

                <p className="register-security-note">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  Invite checks and tenant routing are handled automatically.
                </p>

                <p className="register-signin-link">
                  Already have access? <a href="/login">Sign in</a>
                </p>
                <p className="register-signin-link">
                  Need a new workspace? <a href="/get-started">Start free trial</a>
                </p>
              </>
            ) : (
              <div className="register-success">
                <div className="register-success-icon">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                </div>
                <h2>Account created</h2>
                <p>{message}</p>
                <div className="register-success-actions">
                  <a href="/login" className="register-submit-btn">
                    Go to Sign In
                  </a>
                  {tenantSlug ? (
                    <a href={`/tenant/${tenantSlug}`} className="register-secondary-btn">
                      View workspace homepage
                    </a>
                  ) : null}
                  <a href="/" className="register-secondary-btn">
                    Back to Habuks
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="register-illustration-col">
          <div className="register-illustration-bg">
            <img
              src="/assets/register-dashboard-stats.png"
              alt="Dashboard preview"
              className="register-dashboard-image"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
