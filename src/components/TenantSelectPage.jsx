import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import SiteHeader from "./SiteHeader.jsx";
import SiteFooter from "./SiteFooter.jsx";
import {
  getCurrentMember,
  getTenantMemberships,
  createTenantMembership,
  getTenantBySlug,
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

        if (list.length === 1 && list[0]?.tenant?.slug) {
          const slug = list[0].tenant.slug;
          localStorage.setItem("lastTenantSlug", slug);
          navigate(`/tenant/${slug}/dashboard`);
          return;
        }

        const lastSlug = localStorage.getItem("lastTenantSlug");
        if (lastSlug && list.some((item) => item.tenant?.slug === lastSlug)) {
          navigate(`/tenant/${lastSlug}/dashboard`);
          return;
        }
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

  if (loading) {
    return (
      <div className="tenant-select-loading">
        <div className="loading-spinner"></div>
        <p>Loading your workspaces...</p>
      </div>
    );
  }

  return (
    <div className="app-shell tenant-select-shell">
      <SiteHeader data={data} hideTopBar />
      <main className="page-body tenant-select-page">
        <div className="container tenant-select-inner">
          <div className="tenant-select-header">
            <h1>Select a workspace</h1>
            <p>Choose the tenant workspace you want to manage.</p>
          </div>

          {error ? <p className="tenant-error">{error}</p> : null}

          {memberships.length === 0 ? (
            <div className="tenant-empty">
              <h2>No workspaces yet</h2>
              <p>Create a tenant workspace to get started, or claim the workspace you just created.</p>
              <a className="btn btn-primary" href="/get-started">
                Create workspace
              </a>
              <div className="tenant-claim">
                <h3>Claim existing workspace</h3>
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
              </div>
            </div>
          ) : (
            <div className="tenant-select-grid">
              {memberships.map((membership) => {
                const tenant = membership.tenant || {};
                const slug = tenant.slug || "";
                return (
                  <button
                    key={membership.id}
                    className="tenant-select-card"
                    type="button"
                    onClick={() => {
                      if (!slug) return;
                      localStorage.setItem("lastTenantSlug", slug);
                      navigate(`/tenant/${slug}/dashboard`);
                    }}
                  >
                    <div className="tenant-select-card-header">
                      <img
                        src={tenant.logo_url || data.logoUrl || "/assets/logo.png"}
                        alt={tenant.name || "Tenant"}
                      />
                      <div>
                        <h3>{tenant.name || "Tenant"}</h3>
                        <p>{tenant.tagline || "Workspace"}</p>
                      </div>
                    </div>
                    <span className="tenant-role">Role: {membership.role}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </main>
      <SiteFooter data={data} />
    </div>
  );
}
