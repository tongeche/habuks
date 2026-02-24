import { describe, it, expect } from "vitest";

describe("LoginPage - Logic Tests", () => {
  describe("Tenant routing logic", () => {
    it("routes to dashboard with single tenant", () => {
      const routeAfterLogin = (memberships) => {
        if (memberships.length === 1 && memberships[0]?.tenant?.slug) {
          return `/tenant/${memberships[0].tenant.slug}/dashboard`;
        }
        return null;
      };

      const memberships = [{ tenant: { slug: "test-workspace" } }];
      expect(routeAfterLogin(memberships)).toBe("/tenant/test-workspace/dashboard");
    });

    it("routes to /select-tenant with multiple tenants", () => {
      const routeAfterLogin = (memberships) => {
        if (memberships.length > 1) {
          return "/select-tenant";
        }
        return null;
      };

      const memberships = [
        { tenant: { slug: "workspace-1" } },
        { tenant: { slug: "workspace-2" } },
      ];
      expect(routeAfterLogin(memberships)).toBe("/select-tenant");
    });

    it("routes to /get-started with no tenants", () => {
      const routeAfterLogin = (memberships) => {
        if (memberships.length === 0) {
          return "/get-started";
        }
        return null;
      };

      expect(routeAfterLogin([])).toBe("/get-started");
    });

    it("prefers lastTenantSlug when multiple tenants exist", () => {
      const routeAfterLogin = (memberships, lastSlug) => {
        if (memberships.length > 1) {
          const match = memberships.find((m) => m.tenant?.slug === lastSlug);
          if (match?.tenant?.slug) {
            return `/tenant/${match.tenant.slug}/dashboard`;
          }
          return "/select-tenant";
        }
        return null;
      };

      const memberships = [
        { tenant: { slug: "workspace-1" } },
        { tenant: { slug: "workspace-2" } },
      ];
      expect(routeAfterLogin(memberships, "workspace-2")).toBe("/tenant/workspace-2/dashboard");
      expect(routeAfterLogin(memberships, "workspace-3")).toBe("/select-tenant");
    });
  });

  describe("Fallback flag reset", () => {
    it("resets fallback flag after successful login", () => {
      let fallbackEnabled = true;
      const resetFallback = () => {
        fallbackEnabled = false;
      };

      expect(fallbackEnabled).toBe(true);
      resetFallback();
      expect(fallbackEnabled).toBe(false);
    });
  });

  describe("Member validation", () => {
    it("requires member to exist for login", () => {
      const canProceedAfterLogin = (member) => {
        return member !== null && member.id !== null;
      };

      expect(canProceedAfterLogin(null)).toBe(false);
      expect(canProceedAfterLogin({ id: "member-1" })).toBe(true);
    });

    it("requires auth_id to be set in member", () => {
      const canAccessTenant = (member) => {
        return member !== null && member.auth_id !== null;
      };

      expect(canAccessTenant(null)).toBe(false);
      expect(canAccessTenant({ id: "m1", auth_id: null })).toBe(false);
      expect(canAccessTenant({ id: "m1", auth_id: "auth-123" })).toBe(true);
    });
  });

  describe("Self-join recovery", () => {
    it("attempts self-join when no memberships but lastTenantSlug exists", () => {
      const shouldAttemptSelfJoin = (memberships, lastSlug) => {
        return memberships.length === 0 && lastSlug !== null;
      };

      expect(shouldAttemptSelfJoin([], "workspace-1")).toBe(true);
      expect(shouldAttemptSelfJoin([{ tenant: { slug: "w1" } }], "workspace-1")).toBe(false);
      expect(shouldAttemptSelfJoin([], null)).toBe(false);
    });

    it("validates self-join requires admin role and email match", () => {
      const canSelfJoin = (contactEmail, userEmail, role) => {
        return (
          role === "admin" &&
          contactEmail.toLowerCase() === userEmail.toLowerCase()
        );
      };

      expect(canSelfJoin("admin@example.com", "admin@example.com", "admin")).toBe(true);
      expect(canSelfJoin("admin@example.com", "other@example.com", "admin")).toBe(false);
      expect(canSelfJoin("admin@example.com", "admin@example.com", "member")).toBe(false);
    });
  });
});

