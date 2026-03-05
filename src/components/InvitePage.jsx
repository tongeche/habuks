import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase, isSupabaseConfigured } from "../lib/supabase.js";
import {
  applyMagicLinkInviteProjectAccess,
  createTenantMembership,
  getTenantById,
  markMagicLinkInviteUsed,
  markInviteUsed,
  recoverMagicLinkTenantMembership,
  verifyMagicLinkInvite,
  verifyMemberInvite,
} from "../lib/dataService.js";

const normalizeInviteToken = (value) => String(value || "").trim().replace(/\s+/g, "");
const isNumericInviteToken = (value) => /^\d{6,10}$/.test(normalizeInviteToken(value));

const inferNameFromEmail = (email, fallback = "Member") => {
  const localPart = String(email || "").split("@")[0] || "";
  const parsed = localPart.replace(/[._-]+/g, " ").trim();
  return parsed || fallback;
};

const resolveInviteOwner = (invite) =>
  invite?.invited_by_name ||
  invite?.created_by_name ||
  invite?.invited_by ||
  invite?.created_by_email ||
  invite?.created_by ||
  "";

export default function InvitePage() {
  const navigate = useNavigate();
  const { token: routeToken } = useParams();
  const [inviteCode, setInviteCode] = useState(() => normalizeInviteToken(routeToken));
  const [inviteState, setInviteState] = useState(null);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    password: "",
  });

  const invitedBy = useMemo(
    () => resolveInviteOwner(inviteState?.invite),
    [inviteState]
  );

  const verifyInviteCode = async (code) => {
    const normalizedCode = normalizeInviteToken(code);
    if (!normalizedCode) {
      throw new Error("Invite code is required.");
    }
    if (!isSupabaseConfigured || !supabase) {
      throw new Error("Supabase is not configured. Update your .env values and restart.");
    }

    const attemptOrder = isNumericInviteToken(normalizedCode)
      ? [
          { kind: "magic", verify: verifyMagicLinkInvite },
          { kind: "member", verify: verifyMemberInvite },
        ]
      : [
          { kind: "member", verify: verifyMemberInvite },
          { kind: "magic", verify: verifyMagicLinkInvite },
        ];

    let invite = null;
    let inviteKind = "";
    let lastError = null;

    for (const attempt of attemptOrder) {
      try {
        const candidate = await attempt.verify(normalizedCode);
        if (candidate) {
          invite = candidate;
          inviteKind = attempt.kind;
          break;
        }
      } catch (verifyError) {
        lastError = verifyError;
      }
    }

    if (!invite) {
      throw lastError || new Error("Invalid or expired invite.");
    }

    if (!invite?.tenant_id) {
      throw new Error("Invite is not linked to a workspace.");
    }

    const tenant = await getTenantById(invite.tenant_id);
    if (!tenant) {
      throw new Error("The workspace linked to this invite no longer exists.");
    }

    setInviteState({ invite, inviteKind, tenant });
    setFormData((previous) => ({
      ...previous,
      email: invite?.email || previous.email,
      full_name:
        previous.full_name ||
        inferNameFromEmail(invite?.email, tenant?.name || "Member"),
    }));
    setInviteCode(normalizedCode);
    setMessage("Invite verified. Complete your profile to join.");
    return { invite, inviteKind, tenant };
  };

  useEffect(() => {
    const normalized = normalizeInviteToken(routeToken);
    if (!normalized) {
      setInviteCode("");
      return;
    }
    let active = true;
    setVerifying(true);
    setError("");
    setMessage("");
    verifyInviteCode(normalized)
      .catch((verifyError) => {
        if (!active) return;
        setError(verifyError?.message || "Could not verify invite.");
      })
      .finally(() => {
        if (active) {
          setVerifying(false);
        }
      });
    return () => {
      active = false;
    };
  }, [routeToken]);

  const handleCodeSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setVerifying(true);
    try {
      await verifyInviteCode(inviteCode);
    } catch (verifyError) {
      setError(verifyError?.message || "Could not verify invite.");
    } finally {
      setVerifying(false);
    }
  };

  const handleFormChange = (event) => {
    const { name, value } = event.target;
    setFormData((previous) => ({ ...previous, [name]: value }));
    setError("");
    setMessage("");
  };

  const handleJoinWorkspace = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      if (!inviteState?.invite || !inviteState?.tenant) {
        setError("Invite verification is required before joining.");
        return;
      }

      const fullName = formData.full_name.trim();
      const email = formData.email.trim().toLowerCase();
      const password = formData.password;
      const { invite, inviteKind, tenant } = inviteState;

      if (!email || !password) {
        setError("Email and password are required.");
        return;
      }

      if (password.length < 8) {
        setError("Password must be at least 8 characters.");
        return;
      }

      if (invite?.email && String(invite.email).toLowerCase() !== email) {
        setError("This invite is linked to a different email address.");
        return;
      }

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: fullName || inferNameFromEmail(email, tenant?.name || "Member"),
            role: invite?.role || "member",
          },
        },
      });

      if (signUpError) {
        setError(signUpError.message || "Unable to create account.");
        return;
      }

      const authUserId = signUpData?.user?.id;
      if (!authUserId) {
        setError("Signup completed but user information is missing.");
        return;
      }

      const memberPayload = {
        name: fullName || inferNameFromEmail(email, tenant?.name || "Member"),
        email,
        phone_number: invite?.phone_number || null,
        role: invite?.role || "member",
        status: "active",
        join_date: new Date().toISOString().slice(0, 10),
        auth_id: authUserId,
        password_hash: "auth_managed",
      };

      let memberId = null;
      const { data: createdMember, error: createMemberError } = await supabase
        .from("members")
        .insert(memberPayload)
        .select("id")
        .single();

      if (createdMember?.id) {
        memberId = createdMember.id;
      } else if (String(createMemberError?.code || "") === "23505") {
        const { data: linkedMember, error: linkError } = await supabase
          .from("members")
          .update({
            auth_id: authUserId,
            name: memberPayload.name,
            phone_number: memberPayload.phone_number,
          })
          .ilike("email", email)
          .select("id")
          .maybeSingle();
        if (linkError) {
          setError(linkError.message || "Unable to link member profile.");
          return;
        }
        memberId = linkedMember?.id || null;
      } else if (createMemberError) {
        setError(createMemberError.message || "Unable to create member profile.");
        return;
      }

      if (!memberId) {
        setError("Unable to create member profile.");
        return;
      }

      const membershipRole = String(invite?.role || "").toLowerCase().includes("admin")
        ? "admin"
        : invite?.role || "member";

      try {
        await createTenantMembership({
          tenantId: invite.tenant_id,
          memberId,
          role: membershipRole,
        });
      } catch (membershipError) {
        if (String(membershipError?.code || "") !== "23505") {
          console.warn("Invite join: membership setup warning:", membershipError);
        }
      }

      try {
        await recoverMagicLinkTenantMembership(memberId, tenant?.slug || null);
      } catch (recoverError) {
        console.warn("Invite join: membership recovery warning:", recoverError);
      }

      if (inviteKind === "magic") {
        try {
          await applyMagicLinkInviteProjectAccess(invite.id, memberId);
        } catch (projectAccessError) {
          console.warn("Invite join: project access warning:", projectAccessError);
        }
      }

      try {
        if (inviteKind === "magic") {
          await markMagicLinkInviteUsed(invite.id, memberId);
        } else {
          await markInviteUsed(invite.id);
        }
      } catch (markError) {
        console.warn("Invite join: mark invite warning:", markError);
      }

      const tenantSlug = String(tenant?.slug || "").trim().toLowerCase();
      if (tenantSlug && typeof window !== "undefined") {
        window.localStorage.setItem("lastTenantSlug", tenantSlug);
        window.localStorage.setItem("pendingInviteTenantSlug", tenantSlug);
      }

      if (signUpData?.session) {
        navigate(tenantSlug ? `/tenant/${tenantSlug}/dashboard` : "/dashboard");
        return;
      }

      setMessage("Account created. Confirm your email, then sign in to continue.");
    } catch (joinError) {
      setError(joinError?.message || "Unable to join workspace right now.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mobile-auth-shell">
      <main className="mobile-auth-card" aria-labelledby="invite-title">
        <h1 id="invite-title" className="mobile-auth-title">
          Join Organization
        </h1>

        {!inviteState ? (
          <form className="mobile-auth-form" onSubmit={handleCodeSubmit}>
            <label className="mobile-auth-field">
              <span>Invite code</span>
              <input
                type="text"
                value={inviteCode}
                onChange={(event) => {
                  setInviteCode(event.target.value);
                  setError("");
                  setMessage("");
                }}
                required
              />
            </label>
            {error ? <p className="mobile-auth-error">{error}</p> : null}
            {message ? <p className="mobile-auth-message">{message}</p> : null}
            <button
              type="submit"
              className="mobile-auth-btn mobile-auth-btn--primary"
              disabled={verifying}
            >
              {verifying ? "Verifying..." : "Verify invite"}
            </button>
          </form>
        ) : (
          <form className="mobile-auth-form" onSubmit={handleJoinWorkspace}>
            <p className="mobile-auth-meta">
              Organization: <strong>{inviteState.tenant?.name || "Workspace"}</strong>
            </p>
            {invitedBy ? (
              <p className="mobile-auth-meta">
                Invited by: <strong>{invitedBy}</strong>
              </p>
            ) : null}
            <label className="mobile-auth-field">
              <span>Full name</span>
              <input
                type="text"
                name="full_name"
                value={formData.full_name}
                onChange={handleFormChange}
                autoComplete="name"
                required
              />
            </label>
            <label className="mobile-auth-field">
              <span>Email</span>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleFormChange}
                autoComplete="email"
                required
              />
            </label>
            <label className="mobile-auth-field">
              <span>Password</span>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleFormChange}
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
              {loading ? "Please wait..." : "Join Workspace"}
            </button>
          </form>
        )}

        <p className="mobile-auth-meta">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
        <p className="mobile-auth-meta">
          <Link to="/welcome">← Back</Link>
        </p>
      </main>
    </div>
  );
}
