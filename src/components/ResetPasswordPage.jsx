import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { supabase, isSupabaseConfigured } from "../lib/supabase.js";

const normalizeToken = (value) => String(value || "").trim();

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { token: routeToken } = useParams();
  const [mode, setMode] = useState("request");
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [formData, setFormData] = useState({
    password: "",
    confirm_password: "",
  });

  const recoveryToken = useMemo(() => {
    const searchParams = new URLSearchParams(location.search || "");
    const fromSearch = normalizeToken(searchParams.get("token_hash"));
    const fromPath = normalizeToken(routeToken);
    return fromPath || fromSearch || "";
  }, [location.search, routeToken]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      return;
    }

    let active = true;
    const bootstrapRecoveryState = async () => {
      setInitializing(true);
      setError("");

      try {
        if (recoveryToken) {
          const { error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: recoveryToken,
            type: "recovery",
          });
          if (verifyError) {
            throw verifyError;
          }
          if (active) {
            setMode("update");
          }
          return;
        }

        const hashParams = new URLSearchParams(String(window.location.hash || "").replace(/^#/, ""));
        const hashType = hashParams.get("type");
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        if (hashType === "recovery" && accessToken && refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (sessionError) {
            throw sessionError;
          }
          if (active) {
            setMode("update");
          }
          return;
        }
      } catch (recoveryError) {
        if (active) {
          setError(recoveryError?.message || "Reset link is invalid or expired.");
        }
      } finally {
        if (active) {
          setInitializing(false);
        }
      }
    };

    bootstrapRecoveryState();
    return () => {
      active = false;
    };
  }, [recoveryToken]);

  const handleSendResetLink = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      if (!isSupabaseConfigured || !supabase) {
        setError("Supabase is not configured. Update your .env values and restart.");
        return;
      }

      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedEmail) {
        setError("Email is required.");
        return;
      }

      const redirectTo = `${window.location.origin}/reset-password`;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo,
      });
      if (resetError) {
        setError(resetError.message || "Unable to send reset email.");
        return;
      }

      setMessage("Reset link sent. Check your email.");
    } catch (requestError) {
      setError(requestError?.message || "Unable to send reset link.");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      if (!isSupabaseConfigured || !supabase) {
        setError("Supabase is not configured. Update your .env values and restart.");
        return;
      }

      const password = formData.password;
      const confirmPassword = formData.confirm_password;
      if (!password || !confirmPassword) {
        setError("Both password fields are required.");
        return;
      }
      if (password.length < 8) {
        setError("Password must be at least 8 characters.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message || "Unable to reset password.");
        return;
      }

      setMessage("Password reset successful. Redirecting to sign in...");
      window.setTimeout(() => {
        navigate("/login");
      }, 1200);
    } catch (updatePasswordError) {
      setError(updatePasswordError?.message || "Unable to reset password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mobile-auth-shell">
      <main className="mobile-auth-card" aria-labelledby="reset-title">
        <h1 id="reset-title" className="mobile-auth-title">
          Reset Password
        </h1>

        {initializing ? (
          <p className="mobile-auth-message">Loading reset session...</p>
        ) : mode === "update" ? (
          <form className="mobile-auth-form" onSubmit={handlePasswordReset}>
            <label className="mobile-auth-field">
              <span>New password</span>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={(event) =>
                  setFormData((previous) => ({ ...previous, password: event.target.value }))
                }
                autoComplete="new-password"
                required
              />
            </label>
            <label className="mobile-auth-field">
              <span>Confirm password</span>
              <input
                type="password"
                name="confirm_password"
                value={formData.confirm_password}
                onChange={(event) =>
                  setFormData((previous) => ({
                    ...previous,
                    confirm_password: event.target.value,
                  }))
                }
                autoComplete="new-password"
                required
              />
            </label>
            {error ? <p className="mobile-auth-error">{error}</p> : null}
            {message ? <p className="mobile-auth-message">{message}</p> : null}
            <button
              type="submit"
              className="mobile-auth-btn mobile-auth-btn--primary"
              disabled={loading}
            >
              {loading ? "Please wait..." : "Reset password"}
            </button>
          </form>
        ) : (
          <form className="mobile-auth-form" onSubmit={handleSendResetLink}>
            <label className="mobile-auth-field">
              <span>Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setError("");
                  setMessage("");
                }}
                autoComplete="email"
                required
              />
            </label>
            {error ? <p className="mobile-auth-error">{error}</p> : null}
            {message ? <p className="mobile-auth-message">{message}</p> : null}
            <button
              type="submit"
              className="mobile-auth-btn mobile-auth-btn--primary"
              disabled={loading}
            >
              {loading ? "Please wait..." : "Send reset link"}
            </button>
          </form>
        )}

        <p className="mobile-auth-meta">
          <Link to="/login">Back to sign in</Link>
        </p>
      </main>
    </div>
  );
}
