import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getCurrentMember,
  getTenantMemberships,
  createTenantMembership,
  getTenantBySlug,
  signOut,
} from "../lib/dataService.js";

const getLandingData = () => {
  if (typeof window !== "undefined" && window.landingData) {
    return window.landingData();
  }
  return {};
};

export default function TenantSelectPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [memberships, setMemberships] = useState([]);
  const [currentMember, setCurrentMember] = useState(null);
  const [error, setError] = useState("");
  const [claimSlug, setClaimSlug] = useState("");
  const [claimError, setClaimError] = useState("");
  const [claimMessage, setClaimMessage] = useState("");
  const [claimLoading, setClaimLoading] = useState(false);
  const [accountActionLoading, setAccountActionLoading] = useState("");
  const data = getLandingData();

  const normalizeSlug = (value) =>
    String(value || "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  useEffect(() => {
    let active = true;

    const loadMemberships = async () => {
      try {
        setClaimError("");
        setClaimMessage("");
        const member = await getCurrentMember();
        if (!member) {
          navigate("/login");
          return;
        }
        if (active) {
          setCurrentMember(member);
        }

        const list = await getTenantMemberships(member.id);
        if (!active) return;
        setMemberships(list);

      } catch (err) {
        if (!active) return;
        setError(err?.message || "Unable to load your tenant access.");
      } finally {
        if (active) setLoading(false);
      }
    };

    loadMemberships();
    return () => {
      active = false;
    };
  }, [navigate]);

  const handleClaimWorkspace = async (e) => {
    e.preventDefault();
    setClaimError("");
    setClaimMessage("");

    if (!currentMember) {
      setClaimError("Please sign in again to claim a workspace.");
      return;
    }

    const cleanSlug = normalizeSlug(claimSlug);
    if (!cleanSlug) {
      setClaimError("Enter the workspace name you created.");
      return;
    }

    setClaimLoading(true);
    try {
      const tenant = await getTenantBySlug(cleanSlug);
      if (!tenant) {
        setClaimError("We could not find a workspace with that name.");
        return;
      }

      await createTenantMembership({
        tenantId: tenant.id,
        memberId: currentMember.id,
        role: "admin",
      });

      const list = await getTenantMemberships(currentMember.id);
      setMemberships(list);
      setClaimMessage("Workspace claimed. Redirecting...");
      if (tenant.slug) {
        localStorage.setItem("lastTenantSlug", tenant.slug);
        navigate(`/tenant/${tenant.slug}/dashboard`);
      }
    } catch (err) {
      if (String(err?.code || "") === "23505") {
        const list = await getTenantMemberships(currentMember.id);
        setMemberships(list);
        setClaimMessage("Workspace already claimed. Redirecting...");
        const existing = list.find((item) => item.tenant?.slug);
        if (existing?.tenant?.slug) {
          localStorage.setItem("lastTenantSlug", existing.tenant.slug);
          navigate(`/tenant/${existing.tenant.slug}/dashboard`);
        }
        return;
      }
      setClaimError(err?.message || "Unable to claim that workspace.");
    } finally {
      setClaimLoading(false);
    }
  };

  const getDisplayEmail = () =>
    String(
      currentMember?.email ||
      currentMember?.contact_email ||
      currentMember?.member_email ||
      ""
    ).trim();

  const initialsFromName = (value) => {
    const name = String(value || "").trim();
    if (!name) return "WS";
    const parts = name.split(/\s+/).filter(Boolean);
    return parts
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("");
  };

  const resolveLastTenantDashboard = () => {
    const slug = String(window.localStorage.getItem("lastTenantSlug") || "")
      .trim()
      .toLowerCase();
    return slug ? `/tenant/${slug}/dashboard` : "/login";
  };

  const handleClose = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate(resolveLastTenantDashboard());
  };

  const handleAccountAction = async (destination) => {
    setAccountActionLoading(destination);
    setError("");
    try {
      await signOut();
      navigate(destination);
    } catch (err) {
      setError(err?.message || "Unable to switch account right now.");
    } finally {
      setAccountActionLoading("");
    }
  };

  if (loading) {
    return (
      <div className="tenant-select-loading">
        <div className="loading-spinner"></div>
        <p>Loading your workspaces...</p>
      </div>
    );
  }

  const memberEmail = getDisplayEmail();
  const lastTenantSlug = String(window.localStorage.getItem("lastTenantSlug") || "")
    .trim()
    .toLowerCase();

  return (
    <div className="tenant-switch-page">
      <div className="tenant-switch-overlay" />
      <main className="tenant-switch-modal" aria-labelledby="tenant-switch-title" role="dialog" aria-modal="true">
        <button type="button" className="tenant-switch-close" onClick={handleClose} aria-label="Close">
          ×
        </button>
        <section className="tenant-switch-main">
          <a href="/" className="tenant-switch-brand" aria-label="Habuks Home">
            <img src={data.logoUrl || "/assets/logo.png"} alt="Habuks" />
          </a>

          <header className="tenant-switch-header">
            <h1 id="tenant-switch-title">Switch or add an account to continue</h1>
            {memberEmail ? <p>Signed in as {memberEmail}</p> : <p>Select a workspace to continue.</p>}
          </header>

          {error ? <p className="tenant-error">{error}</p> : null}

          {memberships.length ? (
            <div className="tenant-switch-list" role="list" aria-label="Workspace accounts">
              {memberships.map((membership) => {
                const tenant = membership.tenant || {};
                const slug = String(tenant.slug || "").trim();
                const name = tenant.name || "Workspace";
                const role = String(membership.role || "member")
                  .replace(/[_-]+/g, " ")
                  .replace(/\b\w/g, (char) => char.toUpperCase());
                const isCurrent = slug.toLowerCase() === lastTenantSlug;
                return (
                  <button
                    key={membership.id}
                    type="button"
                    className="tenant-switch-account"
                    role="listitem"
                    onClick={() => {
                      if (!slug) return;
                      localStorage.setItem("lastTenantSlug", slug.toLowerCase());
                      navigate(`/tenant/${slug.toLowerCase()}/dashboard`);
                    }}
                  >
                    <span className="tenant-switch-account-avatar">
                      {tenant.logo_url ? (
                        <img src={tenant.logo_url} alt={name} />
                      ) : (
                        <span>{initialsFromName(name)}</span>
                      )}
                    </span>
                    <span className="tenant-switch-account-copy">
                      <strong>{name}</strong>
                      <span>{tenant.tagline || `${role} workspace`}</span>
                    </span>
                    <span className="tenant-switch-account-meta">
                      {isCurrent ? <em>Current</em> : <small>{role}</small>}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="tenant-switch-empty">
              <strong>No workspace memberships yet</strong>
              <span>Create a new account, or claim an existing workspace below.</span>
            </div>
          )}

          <div className="tenant-switch-divider" aria-hidden="true">
            <span>OR</span>
          </div>

          <div className="tenant-switch-actions">
            <button
              type="button"
              className="tenant-switch-action tenant-switch-action--ghost"
              onClick={() => handleAccountAction("/login")}
              disabled={Boolean(accountActionLoading)}
            >
              {accountActionLoading === "/login" ? "Switching..." : "Continue with another account"}
            </button>
            <button
              type="button"
              className="tenant-switch-action tenant-switch-action--primary"
              onClick={() => handleAccountAction("/signup")}
              disabled={Boolean(accountActionLoading)}
            >
              {accountActionLoading === "/signup" ? "Opening..." : "Create new account"}
            </button>
          </div>

          <details className="tenant-switch-claim">
            <summary>Claim existing workspace</summary>
            <form onSubmit={handleClaimWorkspace} className="tenant-claim-form">
              <label htmlFor="claimSlug">Workspace name</label>
              <input
                id="claimSlug"
                type="text"
                value={claimSlug}
                onChange={(e) => setClaimSlug(e.target.value)}
                placeholder="bangu-youth"
              />
              {claimError ? <p className="tenant-error">{claimError}</p> : null}
              {claimMessage ? <p className="tenant-message">{claimMessage}</p> : null}
              <button type="submit" className="btn btn-secondary" disabled={claimLoading}>
                {claimLoading ? "Claiming..." : "Claim workspace"}
              </button>
            </form>
          </details>
        </section>

        <aside className="tenant-switch-visual" aria-hidden="true">
          <div className="tenant-switch-visual-copy">
            <p>Workspace Access</p>
            <h2>Pick a workspace or start a new account.</h2>
          </div>
        </aside>
      </main>
    </div>
  );
}
