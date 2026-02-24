import { useEffect, useMemo, useState } from "react";
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

export default function DemoLandingPage() {
  const data = useMemo(getLandingData, []);
  const navigate = useNavigate();
  const [sessionReady, setSessionReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  const demoSlug = import.meta.env.VITE_DEMO_TENANT_SLUG || "habuks-demo";

  useEffect(() => {
    let active = true;
    const checkSession = async () => {
      if (!isSupabaseConfigured || !supabase) {
        if (active) {
          setSessionReady(true);
        }
        return;
      }
      const { data: sessionData } = await supabase.auth.getSession();
      if (!active) return;
      setSignedIn(Boolean(sessionData?.session));
      setSessionReady(true);
    };
    checkSession();
    return () => {
      active = false;
    };
  }, []);

  const handleGoDashboard = () => {
    if (demoSlug) {
      localStorage.setItem("lastTenantSlug", demoSlug);
      navigate(`/tenant/${demoSlug}/dashboard`);
    } else {
      navigate("/login");
    }
  };

  const handleViewPublicSite = () => {
    if (demoSlug) {
      navigate(`/tenant/${demoSlug}`);
    }
  };

  return (
    <div className="app-shell demo-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <SiteHeader data={data} hideTopBar />
      <main id="main" className="page-body tenant-signup-page demo-landing-page">
        <section className="tenant-signup-hero demo-hero">
          <div className="container tenant-signup-hero-inner demo-hero-inner">
            <div className="tenant-signup-copy demo-copy">
              <p className="landing-kicker">DEMO WORKSPACE</p>
              <h1>Welcome to the Habuks demo</h1>
              <p className="landing-description">
                You are signed into a live workspace with projects, welfare, and reports prefilled.
                Start with a quick tour, then jump into the dashboard when ready.
              </p>
              <ul className="tenant-signup-list demo-list">
                <li>Real project and finance data</li>
                <li>Member contributions and welfare cycles</li>
                <li>Dashboard and reports ready to explore</li>
              </ul>
            </div>

            <div className="tenant-signup-card demo-card demo-landing-card">
              <div className="demo-card-header">
                <a href="/" className="auth-logo">
                  <img src="/assets/logo.png" alt="Habuks" />
                </a>
                <h2>Ready to explore?</h2>
                <p className="tenant-helper">
                  Use the buttons below to open the dashboard or view the demo public site.
                </p>
              </div>
              {sessionReady && !signedIn ? (
                <p className="auth-error">
                  You are not signed in. Go back to the demo login to continue.
                </p>
              ) : null}
              <button
                type="button"
                className="auth-btn demo-btn"
                onClick={handleGoDashboard}
                disabled={sessionReady && !signedIn}
              >
                Try the dashboard
              </button>
              <button
                type="button"
                className="auth-btn auth-btn-ghost demo-secondary-btn"
                onClick={handleViewPublicSite}
                disabled={!demoSlug}
              >
                View demo public site
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
