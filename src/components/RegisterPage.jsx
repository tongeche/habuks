import { useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase.js";
import { markInviteUsed, verifyMemberInvite } from "../lib/dataService.js";

const normalizePhone = (value) => String(value || "").replace(/\s+/g, "");

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

      const { error: memberError } = await supabase.from("members").insert(memberPayload);

      if (memberError) {
        if (memberError.code === "23505") {
          const { error: updateError } = await supabase
            .from("members")
            .update({
              auth_id: userId,
              name: fullName,
              phone_number: phone,
              role: invite.role || "member",
              status: "active",
            })
            .eq("email", email);

          if (updateError) {
            setError(updateError.message || "Unable to link member profile.");
            return;
          }
        } else {
          setError(memberError.message || "Unable to create member profile.");
          return;
        }
      }

      await markInviteUsed(invite.id);

      setSuccess(true);
      setMessage(
        "Account created! Check your email to confirm your address, then log in."
      );
    } catch (err) {
      setError(err?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page register-page">
      <div className="auth-form-col">
        <div className="auth-form-inner register-form-inner">
          <a href="/" className="auth-logo">
            <img src="/assets/logo.png" alt="Jongol Foundation" />
          </a>
          {!success ? (
            <>
              <h1>Create your account</h1>
              <p className="auth-note">
                Use your invite code to create a secure account. Only invited members can sign up.
              </p>
              <form onSubmit={handleSubmit} className="auth-form">
                <div className="auth-field">
                  <label htmlFor="full_name">Full name</label>
                  <input
                    id="full_name"
                    type="text"
                    name="full_name"
                    value={formData.full_name}
                    onChange={handleChange}
                    required
                  />
                </div>
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
                  <label htmlFor="phone_number">Phone number</label>
                  <input
                    id="phone_number"
                    type="tel"
                    name="phone_number"
                    value={formData.phone_number}
                    onChange={handleChange}
                    required
                    autoComplete="tel"
                    placeholder="+254 700 000 000"
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
                    autoComplete="new-password"
                  />
                </div>
                <div className="auth-field">
                  <label htmlFor="invite_code">Invite code</label>
                  <input
                    id="invite_code"
                    type="text"
                    name="invite_code"
                    value={formData.invite_code}
                    onChange={handleChange}
                    required
                    placeholder="Paste invite code"
                    autoComplete="one-time-code"
                  />
                </div>
                {error && <p className="auth-error">{error}</p>}
                {message && <p className="auth-message">{message}</p>}
                <button type="submit" className="auth-btn auth-btn-centered" disabled={loading}>
                  {loading ? "Creating account..." : "Create account"}
                </button>
              </form>
              <p className="register-login-link">
                Already have an account? <a href="/login">Login</a>
              </p>
            </>
          ) : (
            <div className="register-success">
              <h2>Account created</h2>
              <p>{message}</p>
              <div className="register-actions">
                <a href="/login" className="auth-btn">
                  Go to Login
                </a>
                <a href="/" className="auth-btn-secondary">
                  Back to Home
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="auth-illustration-col register-illustration-col">
        <div className="auth-illustration register-illustration">
          <svg viewBox="0 0 300 220" fill="none" xmlns="http://www.w3.org/2000/svg">
            <ellipse cx="150" cy="200" rx="130" ry="15" fill="#e6f7f2" />
            <circle cx="150" cy="100" r="25" fill="#2d7a46" />
            <circle cx="150" cy="75" r="18" fill="#398426" />
            <rect x="135" y="125" width="30" height="50" rx="4" fill="#2d7a46" />
            <circle cx="80" cy="110" r="20" fill="#6ca71f" />
            <circle cx="80" cy="90" r="14" fill="#398426" />
            <rect x="68" y="130" width="24" height="40" rx="4" fill="#6ca71f" />
            <circle cx="220" cy="110" r="20" fill="#6ca71f" />
            <circle cx="220" cy="90" r="14" fill="#398426" />
            <rect x="208" y="130" width="24" height="40" rx="4" fill="#6ca71f" />
            <path d="M100 115 L130 105" stroke="#b6ead1" strokeWidth="2" strokeDasharray="4 2" />
            <path d="M200 115 L170 105" stroke="#b6ead1" strokeWidth="2" strokeDasharray="4 2" />
            <circle cx="50" cy="60" r="6" fill="#b6ead1" />
            <circle cx="250" cy="50" r="8" fill="#b6ead1" />
            <circle cx="280" cy="120" r="5" fill="#2d7a46" />
            <circle cx="20" cy="140" r="4" fill="#2d7a46" />
            <circle cx="120" cy="40" r="4" fill="#6ca71f" />
            <circle cx="180" cy="35" r="3" fill="#6ca71f" />
          </svg>
        </div>
      </div>
    </div>
  );
}
