import { useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase.js";

export default function LoginPage() {
  const [loginMode, setLoginMode] = useState("email");
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    invite_code: "",
    phone_number: "",
    pin: "",
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
      if (loginMode === "email") {
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

        window.location.assign("/dashboard");
        return;
      }

      if (!formData.invite_code.trim()) {
        setError("Invite code is required.");
        return;
      }

      if (!formData.pin.trim()) {
        setError("PIN is required.");
        return;
      }

      setMessage("Invite/PIN access will be enabled once the secure backend flow is ready.");
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
          <div className="auth-tabs">
            <button
              type="button"
              className={loginMode === "email" ? "auth-tab active" : "auth-tab"}
              onClick={() => {
                setLoginMode("email");
                setError("");
                setMessage("");
              }}
            >
              Email Login
            </button>
            <button
              type="button"
              className={loginMode === "invite" ? "auth-tab active" : "auth-tab"}
              onClick={() => {
                setLoginMode("invite");
                setError("");
                setMessage("");
              }}
            >
              Invite + PIN
            </button>
          </div>
          <h1>{loginMode === "email" ? "Login" : "Enter Invite Code"}</h1>
          <form onSubmit={handleSubmit} className="auth-form">
            {loginMode === "email" ? (
              <>
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
              </>
            ) : (
              <>
                <div className="auth-field">
                  <label htmlFor="invite_code">Invite Code</label>
                  <input
                    id="invite_code"
                    type="text"
                    name="invite_code"
                    value={formData.invite_code}
                    onChange={handleChange}
                    required
                    placeholder="JNG-XXXX-XXXX-XXXX"
                    autoComplete="one-time-code"
                  />
                </div>
                <div className="auth-field">
                  <label htmlFor="phone_number">Phone Number (optional)</label>
                  <input
                    id="phone_number"
                    type="tel"
                    name="phone_number"
                    value={formData.phone_number}
                    onChange={handleChange}
                    placeholder="+254 700 000 000"
                    autoComplete="tel"
                  />
                </div>
                <div className="auth-field">
                  <label htmlFor="pin">PIN</label>
                  <input
                    id="pin"
                    type="password"
                    name="pin"
                    value={formData.pin}
                    onChange={handleChange}
                    required
                    autoComplete="current-password"
                    placeholder="6-digit PIN"
                  />
                </div>
              </>
            )}
            {error && <p className="auth-error">{error}</p>}
            {message && <p className="auth-message">{message}</p>}
            <button type="submit" className="auth-btn auth-btn-centered" disabled={loading}>
              {loading ? "Please wait..." : loginMode === "email" ? "Login" : "Continue"}
            </button>
          </form>
          <a href="/" className="auth-back">← Back to Home</a>
        </div>
      </div>
    </div>
  );
}
