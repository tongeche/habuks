import { useState, useMemo } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase.js";
import {
  createTenantMembership,
  getTenantById,
  markInviteUsed,
  verifyMemberInvite,
} from "../lib/dataService.js";

const normalizePhone = (value) => String(value || "").replace(/\s+/g, "");

// Password strength calculator
const getPasswordStrength = (password) => {
  if (!password) return { score: 0, label: "", color: "" };
  let score = 0;
  if (password.length >= 6) score++;
  if (password.length >= 8) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  if (score <= 1) return { score: 1, label: "Weak password", color: "#ef4444" };
  if (score <= 2) return { score: 2, label: "Fair password", color: "#f59e0b" };
  if (score <= 3) return { score: 3, label: "Good password", color: "#10b981" };
  return { score: 4, label: "Strong password", color: "#059669" };
};

export default function RegisterPage() {
  const [formData, setFormData] = useState({
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

  const passwordStrength = useMemo(
    () => getPasswordStrength(formData.password),
    [formData.password]
  );

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError("");
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

      const fullName = formData.full_name.trim();
      const email = formData.email.trim();
      const phone = formData.phone_number.trim();
      const password = formData.password;
      const inviteCode = formData.invite_code.trim();

      if (!fullName || !email || !phone || !password || !inviteCode) {
        setError("All fields are required, including the invite code.");
        return;
      }

      if (password.length < 6) {
        setError("Password must be at least 6 characters.");
        return;
      }

      const invite = await verifyMemberInvite(inviteCode);
      if (!invite.tenant_id) {
        setError("This invite is not linked to a tenant workspace.");
        return;
      }

      const tenant = await getTenantById(invite.tenant_id);
      if (!tenant) {
        setError("This invite is linked to a tenant that no longer exists.");
        return;
      }

      if (invite.phone_number) {
        const expectedPhone = normalizePhone(invite.phone_number);
        if (expectedPhone && normalizePhone(phone) !== expectedPhone) {
          setError("This invite code is linked to a different phone number.");
          return;
        }
      }

      if (invite.email) {
        if (String(invite.email).toLowerCase() !== email.toLowerCase()) {
          setError("This invite code is linked to a different email address.");
          return;
        }
      }

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: fullName,
            phone_number: phone,
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
        phone_number: phone,
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
              phone_number: phone,
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

      try {
        await markInviteUsed(invite.id);
      } catch (markError) {
        console.warn("Unable to mark invite used:", markError);
      }

      setSuccess(true);
      setTenantSlug(tenant.slug);
      setMessage(
        "Account created! Check your email to confirm your address, then sign in."
      );
    } catch (err) {
      setError(err?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-page-v2">
      <div className="register-card-container">
        {/* Left: Form Column */}
        <div className="register-form-col">
          <div className="register-form-wrapper">
            {!success ? (
              <>
                <h1 className="register-heading">
                  Create your Habuks<br />workspace access
                </h1>
                <form onSubmit={handleSubmit} className="register-form">
                  {/* Full Name */}
                  <div className="register-field">
                    <span className="register-field-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                        <circle cx="12" cy="7" r="4"/>
                      </svg>
                    </span>
                    <input
                      id="full_name"
                      type="text"
                      name="full_name"
                      value={formData.full_name}
                      onChange={handleChange}
                      placeholder="Full name"
                      required
                    />
                  </div>

                  {/* Email */}
                  <div className="register-field">
                    <span className="register-field-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="4" width="20" height="16" rx="2"/>
                        <path d="M22 7l-10 6L2 7"/>
                      </svg>
                    </span>
                    <input
                      id="email"
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="Email | example@habuks.com"
                      required
                      autoComplete="email"
                    />
                  </div>

                  {/* Phone */}
                  <div className="register-field register-field-phone">
                    <span className="register-phone-flag">
                      <svg width="24" height="16" viewBox="0 0 24 16" fill="none">
                        <rect width="24" height="5.33" fill="#000"/>
                        <rect y="5.33" width="24" height="5.33" fill="#BB0000"/>
                        <rect y="10.67" width="24" height="5.33" fill="#006600"/>
                        <rect y="4.5" width="24" height="7" fill="none" stroke="#fff" strokeWidth="1"/>
                      </svg>
                    </span>
                    <span className="register-phone-code">+254</span>
                    <span className="register-phone-divider">|</span>
                    <input
                      id="phone_number"
                      type="tel"
                      name="phone_number"
                      value={formData.phone_number}
                      onChange={handleChange}
                      placeholder="7000000000"
                      required
                      autoComplete="tel"
                    />
                  </div>

                  {/* Password */}
                  <div className="register-field">
                    <span className="register-field-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                      </svg>
                    </span>
                    <input
                      id="password"
                      type="password"
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="Password"
                      required
                      autoComplete="new-password"
                    />
                  </div>

                  {/* Password Strength Indicator */}
                  {formData.password && (
                    <div className="register-password-strength">
                      <span
                        className="register-strength-label"
                        style={{ color: passwordStrength.color }}
                      >
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
                  )}

                  {/* Invite Code */}
                  <div className="register-field register-field-invite">
                    <input
                      id="invite_code"
                      type="text"
                      name="invite_code"
                      value={formData.invite_code}
                      onChange={handleChange}
                      placeholder="Paste workspace invite code"
                      required
                      autoComplete="one-time-code"
                    />
                  </div>

                  {error && <p className="register-error">{error}</p>}
                  {message && <p className="register-message">{message}</p>}

                  <button type="submit" className="register-submit-btn" disabled={loading}>
                    {loading ? "Creating..." : "Continue"}
                  </button>
                </form>

                <p className="register-security-note">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                  Your data is encrypted and never shared
                </p>

                <p className="register-signin-link">
                  Already have access? <a href="/login">Sign in</a>
                </p>
              </>
            ) : (
              <div className="register-success">
                <div className="register-success-icon">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                  </svg>
                </div>
                <h2>Account created</h2>
                <p>{message}</p>
                <div className="register-success-actions">
                  <a href="/login" className="register-submit-btn">
                    Go to Sign In
                  </a>
                  {tenantSlug && (
                    <a href={`/tenant/${tenantSlug}`} className="register-secondary-btn">
                      View tenant homepage
                    </a>
                  )}
                  <a href="/" className="register-secondary-btn">
                    Back to Habuks
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Illustration Column */}
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
