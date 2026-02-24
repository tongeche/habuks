import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import SiteHeader from "./SiteHeader.jsx";
import SiteFooter from "./SiteFooter.jsx";
import { supabase, isSupabaseConfigured } from "../lib/supabase.js";

const getLandingData = () => {
  if (typeof window !== "undefined" && window.landingData) {
    return window.landingData();
  }
  return {};
};

export default function DemoPage() {
  const data = useMemo(getLandingData, []);
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const demoEmail = import.meta.env.VITE_DEMO_EMAIL || "";
  const demoPassword = import.meta.env.VITE_DEMO_PASSWORD || "";
  const demoSlug = import.meta.env.VITE_DEMO_TENANT_SLUG || "habuks-demo";

  const handleDemoLogin = async () => {
    setError("");

    if (!demoEmail || !demoPassword) {
      setError(
        "Demo credentials are not configured. Set VITE_DEMO_EMAIL and VITE_DEMO_PASSWORD in .env."
      );
      return;
    }

    if (!isSupabaseConfigured || !supabase) {
      setError("Supabase is not configured. Update your .env values and restart.");
      return;
    }

    setLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: demoEmail,
        password: demoPassword,
      });

      if (signInError) {
        setError(signInError.message);
        return;
      }

      if (demoSlug) {
        localStorage.setItem("lastTenantSlug", demoSlug);
      }

      navigate("/demo/landing");
    } catch (err) {
      setError(err?.message || "Unable to sign in to the demo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-shell demo-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <SiteHeader data={data} hideTopBar />
      <main id="main" className="page-body tenant-signup-page demo-page">
        <section className="tenant-signup-hero demo-hero">
          <div className="container tenant-signup-hero-inner demo-hero-inner">
            <div className="tenant-signup-copy demo-copy">
              <p className="landing-kicker">DEMO WORKSPACE</p>
              <h1>Experience Habuks with a live tenant</h1>
              <p className="landing-description">
                Jump into a fully populated workspace to explore projects, welfare, and reports.
                No signup required.
              </p>
              <ul className="tenant-signup-list demo-list">
                <li>Projects + IGA tracking</li>
                <li>Welfare & contributions</li>
                <li>Reports and dashboards</li>
              </ul>
            </div>

            <div className="tenant-signup-card demo-card">
              <div className="demo-card-header">
                <a href="/" className="auth-logo">
                  <img src="/assets/logo.png" alt="Habuks" />
                </a>
                <h2>Try the Habuks demo</h2>
                <p className="tenant-helper">
                  Sign in instantly with demo credentials and explore the workspace.
                </p>
              </div>
              {error ? <p className="auth-error">{error}</p> : null}
              <button
                type="button"
                className="auth-btn demo-btn"
                onClick={handleDemoLogin}
                disabled={loading}
              >
                {loading ? "Signing you in..." : "Continue to demo"}
              </button>
              <p className="register-login-link">
                Want your own workspace? <a href="/get-started">Start free trial</a>
              </p>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter data={data} />
    </div>
  );
}
