import { useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase.js";

export default function LoginPage() {
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

      window.location.assign("/dashboard");
      return;
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
          <h1>Login</h1>
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
              {loading ? "Please wait..." : "Login"}
            </button>
          </form>
          <p className="register-login-link">
            Have an invite code? <a href="/register">Create an account</a>
          </p>
          <a href="/" className="auth-back">← Back to Home</a>
        </div>
      </div>
    </div>
  );
}
