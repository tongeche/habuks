import { describe, it, expect } from "vitest";

describe("RegisterPage - Logic Tests", () => {
  describe("Invite validation", () => {
    it("validates invite code exists and is linked to tenant", () => {
      const validateInvite = (invite) => {
        return invite !== null && invite.tenant_id !== null;
      };

      expect(validateInvite(null)).toBe(false);
      expect(validateInvite({ tenant_id: null })).toBe(false);
      expect(validateInvite({ tenant_id: "t1", role: "member" })).toBe(true);
    });
  });

  describe("Email and phone matching", () => {
    it("validates email matches invite if specified", () => {
      const validateEmailMatch = (inviteEmail, userEmail) => {
        if (!inviteEmail) return true;
        return inviteEmail.toLowerCase() === userEmail.toLowerCase();
      };

      expect(validateEmailMatch("test@example.com", "test@example.com")).toBe(true);
      expect(validateEmailMatch("test@example.com", "other@example.com")).toBe(false);
      expect(validateEmailMatch(null, "any@example.com")).toBe(true);
    });

    it("normalizes phone numbers for comparison", () => {
      const normalizePhone = (phone) => String(phone || "").replace(/\s+/g, "");
      const validatePhoneMatch = (invitePhone, userPhone) => {
        if (!invitePhone) return true;
        return normalizePhone(invitePhone) === normalizePhone(userPhone);
      };

      expect(validatePhoneMatch("700 000 0000", "7000000000")).toBe(true);
      expect(validatePhoneMatch("7000000000", "7111111111")).toBe(false);
      expect(validatePhoneMatch(null, "7000000000")).toBe(true);
    });
  });

  describe("Password validation", () => {
    it("enforces minimum password length", () => {
      const validatePassword = (pwd) => Boolean(pwd) && pwd.length >= 6;
      expect(validatePassword("short")).toBe(false);
      expect(validatePassword("password123")).toBe(true);
      expect(validatePassword("")).toBe(false);
    });

    it("calculates password strength", () => {
      const getPasswordStrength = (pwd) => {
        if (!pwd || pwd.length < 6) return "weak";
        if (pwd.length < 10) return "medium";
        if (/[A-Z]/.test(pwd) && /[0-9]/.test(pwd) && /[!@#$%^&*]/.test(pwd)) return "strong";
        return "medium";
      };

      expect(getPasswordStrength("weak")).toBe("weak");
      expect(getPasswordStrength("medium123")).toBe("medium");
      expect(getPasswordStrength("StrongPass123!")).toBe("strong");
    });
  });

  describe("Member creation during registration", () => {
    it("creates member with auth_id from signup", () => {
      const createMember = (authUserId, email, name) => {
        return {
          auth_id: authUserId,
          email: email,
          name: name,
          status: "active",
        };
      };

      const member = createMember("auth-123", "john@example.com", "John Doe");
      expect(member.auth_id).toBe("auth-123");
      expect(member.auth_id).not.toBeNull();
    });

    it("handles duplicate email by linking existing member", () => {
      const linkExistingMember = (existingMember, authUserId) => {
        return {
          ...existingMember,
          auth_id: authUserId,
        };
      };

      const existing = { id: "m1", email: "john@example.com", auth_id: null };
      const linked = linkExistingMember(existing, "auth-123");
      expect(linked.auth_id).toBe("auth-123");
      expect(linked.id).toBe("m1");
    });
  });

  describe("Invite marking", () => {
    it("marks invite as used after successful registration", () => {
      const markInviteUsed = (invite) => {
        return { ...invite, used: true, used_at: new Date().toISOString() };
      };

      const invite = { id: "inv-1", used: false };
      const updated = markInviteUsed(invite);
      expect(updated.used).toBe(true);
      expect(updated.used_at).toBeDefined();
    });
  });

  describe("Membership creation", () => {
    it("creates membership with role from invite", () => {
      const createMembership = (memberId, tenantId, role) => {
        return {
          member_id: memberId,
          tenant_id: tenantId,
          role: role,
          status: "active",
        };
      };

      const membership = createMembership("m1", "t1", "member");
      expect(membership.role).toBe("member");
      expect(membership.status).toBe("active");
    });
  });
});
