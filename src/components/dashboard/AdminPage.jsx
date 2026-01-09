import { useEffect, useMemo, useState } from "react";
import {
  createMemberAdmin,
  updateMemberAdmin,
  getMembersAdmin,
  getMemberInvites,
  createMemberInvite,
  revokeMemberInvite,
  isAdminUser,
} from "../../lib/dataService.js";
import { Icon } from "../icons.jsx";

const initialMemberForm = {
  name: "",
  email: "",
  phone_number: "",
  auth_id: "",
  role: "member",
  status: "active",
  join_date: new Date().toISOString().slice(0, 10),
  gender: "",
  national_id: "",
  occupation: "",
  address: "",
  county: "",
  sub_county: "",
  emergency_contact_name: "",
  emergency_contact_phone: "",
  emergency_contact_relationship: "",
};

const initialInviteForm = {
  email: "",
  phone_number: "",
  role: "member",
  expires_in_days: "30",
  notes: "",
};

export default function AdminPage({ user }) {
  const [members, setMembers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [memberForm, setMemberForm] = useState(initialMemberForm);
  const [inviteForm, setInviteForm] = useState(initialInviteForm);
  const [selectedMemberId, setSelectedMemberId] = useState(null);
  const [generatedInvite, setGeneratedInvite] = useState(null);
  const [search, setSearch] = useState("");
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [loadingInvites, setLoadingInvites] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const isAdmin = isAdminUser(user);

  const filteredMembers = useMemo(() => {
    if (!search.trim()) {
      return members;
    }
    const query = search.toLowerCase();
    return members.filter((member) => {
      return (
        member.name?.toLowerCase().includes(query) ||
        member.email?.toLowerCase().includes(query) ||
        member.phone_number?.toLowerCase().includes(query)
      );
    });
  }, [members, search]);

  useEffect(() => {
    if (!isAdmin) {
      return;
    }
    loadMembers();
    loadInvites();
  }, [isAdmin]);

  const loadMembers = async () => {
    setLoadingMembers(true);
    try {
      const data = await getMembersAdmin();
      setMembers(data);
    } catch (error) {
      setErrorMessage(error.message || "Failed to load members.");
    } finally {
      setLoadingMembers(false);
    }
  };

  const loadInvites = async () => {
    setLoadingInvites(true);
    try {
      const data = await getMemberInvites();
      setInvites(data);
    } catch (error) {
      setErrorMessage(error.message || "Failed to load invites.");
    } finally {
      setLoadingInvites(false);
    }
  };

  const resetMessages = () => {
    setStatusMessage("");
    setErrorMessage("");
  };

  const handleMemberChange = (e) => {
    const { name, value } = e.target;
    setMemberForm((prev) => ({ ...prev, [name]: value }));
    resetMessages();
  };

  const handleInviteChange = (e) => {
    const { name, value } = e.target;
    setInviteForm((prev) => ({ ...prev, [name]: value }));
    resetMessages();
  };

  const handleMemberSubmit = async (e) => {
    e.preventDefault();
    resetMessages();

    if (!memberForm.name.trim()) {
      setErrorMessage("Member name is required.");
      return;
    }

    if (!memberForm.phone_number.trim()) {
      setErrorMessage("Phone number is required.");
      return;
    }

    try {
      if (selectedMemberId) {
        await updateMemberAdmin(selectedMemberId, memberForm);
        setStatusMessage("Member updated successfully.");
      } else {
        await createMemberAdmin(memberForm);
        setStatusMessage("Member created successfully.");
      }
      setMemberForm(initialMemberForm);
      setSelectedMemberId(null);
      await loadMembers();
    } catch (error) {
      setErrorMessage(error.message || "Failed to save member.");
    }
  };

  const handleEditMember = (member) => {
    setMemberForm({
      ...initialMemberForm,
      ...member,
    });
    setSelectedMemberId(member.id);
    resetMessages();
  };

  const handleMemberCancel = () => {
    setMemberForm(initialMemberForm);
    setSelectedMemberId(null);
    resetMessages();
  };

  const handleInviteSubmit = async (e) => {
    e.preventDefault();
    resetMessages();

    if (!inviteForm.email.trim()) {
      setErrorMessage("Invite email is required.");
      return;
    }

    try {
      const days = Number.parseInt(inviteForm.expires_in_days, 10);
      const expiresAt = Number.isFinite(days)
        ? new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
        : null;

      const { invite, code } = await createMemberInvite({
        email: inviteForm.email,
        phone_number: inviteForm.phone_number,
        role: inviteForm.role,
        expires_at: expiresAt,
        notes: inviteForm.notes,
        created_by: user?.id,
      });

      setGeneratedInvite({ code, invite });
      setInviteForm(initialInviteForm);
      setStatusMessage("Invite created. Share the code with the member.");
      await loadInvites();
    } catch (error) {
      setErrorMessage(error.message || "Failed to create invite.");
    }
  };

  const handleRevokeInvite = async (inviteId) => {
    resetMessages();
    try {
      await revokeMemberInvite(inviteId);
      setStatusMessage("Invite revoked.");
      await loadInvites();
    } catch (error) {
      setErrorMessage(error.message || "Failed to revoke invite.");
    }
  };

  const handleCopyInvite = async () => {
    if (!generatedInvite?.code) {
      return;
    }
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(generatedInvite.code);
        setStatusMessage("Invite code copied to clipboard.");
      }
    } catch (error) {
      setErrorMessage("Unable to copy invite code.");
    }
  };

  if (!isAdmin) {
    return (
      <div className="admin-panel">
        <div className="admin-card">
          <h2>Admin Access Required</h2>
          <p>You do not have permission to access admin tools.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <div>
          <h2>Admin Panel</h2>
          <p>Manage members, roles, and invite codes for {user?.name || "the group"}.</p>
        </div>
        <div className="admin-header-actions">
          <button className="btn-secondary" type="button" onClick={() => loadMembers()}>
            Refresh Members
          </button>
          <button className="btn-secondary" type="button" onClick={() => loadInvites()}>
            Refresh Invites
          </button>
        </div>
      </div>

      {(statusMessage || errorMessage) && (
        <div className={`admin-alert ${errorMessage ? "is-error" : "is-success"}`}>
          <span>{errorMessage || statusMessage}</span>
        </div>
      )}

      <div className="admin-grid">
        <div className="admin-card">
          <h3>{selectedMemberId ? "Edit Member" : "Create Member"}</h3>
          <p className="admin-help">
            Create a member profile after the auth account exists. Add the auth ID to link sign-in
            access.
          </p>
          <form className="admin-form" onSubmit={handleMemberSubmit}>
            <div className="admin-form-grid">
              <div className="admin-form-field">
                <label>Name *</label>
                <input
                  name="name"
                  value={memberForm.name}
                  onChange={handleMemberChange}
                  placeholder="Full name"
                />
              </div>
              <div className="admin-form-field">
                <label>Auth ID</label>
                <input
                  name="auth_id"
                  value={memberForm.auth_id}
                  onChange={handleMemberChange}
                  placeholder="Supabase auth UUID"
                />
              </div>
              <div className="admin-form-field">
                <label>Email</label>
                <input
                  name="email"
                  type="email"
                  value={memberForm.email}
                  onChange={handleMemberChange}
                  placeholder="email@example.com"
                />
              </div>
              <div className="admin-form-field">
                <label>Phone Number *</label>
                <input
                  name="phone_number"
                  value={memberForm.phone_number}
                  onChange={handleMemberChange}
                  placeholder="+254 700 000 000"
                />
              </div>
              <div className="admin-form-field">
                <label>Role</label>
                <select name="role" value={memberForm.role} onChange={handleMemberChange}>
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                  <option value="superadmin">Super Admin</option>
                </select>
              </div>
              <div className="admin-form-field">
                <label>Status</label>
                <select name="status" value={memberForm.status} onChange={handleMemberChange}>
                  <option value="active">Active</option>
                  <option value="pending">Pending</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div className="admin-form-field">
                <label>Join Date</label>
                <input
                  type="date"
                  name="join_date"
                  value={memberForm.join_date}
                  onChange={handleMemberChange}
                />
              </div>
              <div className="admin-form-field">
                <label>Gender</label>
                <select name="gender" value={memberForm.gender} onChange={handleMemberChange}>
                  <option value="">Select gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="admin-form-field">
                <label>Occupation</label>
                <input
                  name="occupation"
                  value={memberForm.occupation}
                  onChange={handleMemberChange}
                  placeholder="Occupation"
                />
              </div>
              <div className="admin-form-field">
                <label>National ID</label>
                <input
                  name="national_id"
                  value={memberForm.national_id}
                  onChange={handleMemberChange}
                  placeholder="ID number"
                />
              </div>
              <div className="admin-form-field admin-form-field--full">
                <label>Address</label>
                <input
                  name="address"
                  value={memberForm.address}
                  onChange={handleMemberChange}
                  placeholder="Street address"
                />
              </div>
              <div className="admin-form-field">
                <label>County</label>
                <input
                  name="county"
                  value={memberForm.county}
                  onChange={handleMemberChange}
                  placeholder="County"
                />
              </div>
              <div className="admin-form-field">
                <label>Sub-County</label>
                <input
                  name="sub_county"
                  value={memberForm.sub_county}
                  onChange={handleMemberChange}
                  placeholder="Sub-county"
                />
              </div>
            </div>

            <h4 className="admin-section-title">
              <Icon name="heart" size={16} /> Emergency Contact
            </h4>
            <div className="admin-form-grid">
              <div className="admin-form-field">
                <label>Name</label>
                <input
                  name="emergency_contact_name"
                  value={memberForm.emergency_contact_name}
                  onChange={handleMemberChange}
                  placeholder="Contact name"
                />
              </div>
              <div className="admin-form-field">
                <label>Phone</label>
                <input
                  name="emergency_contact_phone"
                  value={memberForm.emergency_contact_phone}
                  onChange={handleMemberChange}
                  placeholder="Contact phone"
                />
              </div>
              <div className="admin-form-field">
                <label>Relationship</label>
                <select
                  name="emergency_contact_relationship"
                  value={memberForm.emergency_contact_relationship}
                  onChange={handleMemberChange}
                >
                  <option value="">Select</option>
                  <option value="spouse">Spouse</option>
                  <option value="parent">Parent</option>
                  <option value="sibling">Sibling</option>
                  <option value="child">Child</option>
                  <option value="friend">Friend</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div className="admin-form-actions">
              <button className="btn-primary" type="submit">
                {selectedMemberId ? "Save Changes" : "Create Member"}
              </button>
              {selectedMemberId && (
                <button className="btn-secondary" type="button" onClick={handleMemberCancel}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        <div className="admin-card">
          <h3>Generate Invite Code</h3>
          <p className="admin-help">
            Create a one-time invite code to track onboarding. Share the code securely with the
            member.
          </p>
          <form className="admin-form" onSubmit={handleInviteSubmit}>
            <div className="admin-form-grid">
              <div className="admin-form-field">
                <label>Email *</label>
                <input
                  name="email"
                  type="email"
                  value={inviteForm.email}
                  onChange={handleInviteChange}
                  placeholder="member@example.com"
                />
              </div>
              <div className="admin-form-field">
                <label>Phone</label>
                <input
                  name="phone_number"
                  value={inviteForm.phone_number}
                  onChange={handleInviteChange}
                  placeholder="+254 700 000 000"
                />
              </div>
              <div className="admin-form-field">
                <label>Role</label>
                <select name="role" value={inviteForm.role} onChange={handleInviteChange}>
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                  <option value="superadmin">Super Admin</option>
                </select>
              </div>
              <div className="admin-form-field">
                <label>Expires (days)</label>
                <input
                  name="expires_in_days"
                  value={inviteForm.expires_in_days}
                  onChange={handleInviteChange}
                  placeholder="30"
                />
              </div>
              <div className="admin-form-field admin-form-field--full">
                <label>Notes</label>
                <textarea
                  name="notes"
                  value={inviteForm.notes}
                  onChange={handleInviteChange}
                  placeholder="Optional notes for this invite"
                  rows={3}
                />
              </div>
            </div>
            <div className="admin-form-actions">
              <button className="btn-primary" type="submit">
                Generate Invite
              </button>
            </div>
          </form>

          {generatedInvite ? (
            <div className="admin-invite-output">
              <div>
                <span className="admin-invite-label">Invite Code</span>
                <strong>{generatedInvite.code}</strong>
              </div>
              <button className="btn-secondary" type="button" onClick={handleCopyInvite}>
                Copy Code
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-list-header">
          <h3>Members</h3>
          <div className="admin-search">
            <Icon name="search" size={16} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email, phone"
            />
          </div>
        </div>
        {loadingMembers ? (
          <p>Loading members...</p>
        ) : (
          <div className="admin-table">
            <div className="admin-table-row admin-table-head">
              <span>Name</span>
              <span>Email</span>
              <span>Phone</span>
              <span>Role</span>
              <span>Status</span>
              <span>Actions</span>
            </div>
            {filteredMembers.map((member) => (
              <div className="admin-table-row" key={member.id}>
                <span>{member.name}</span>
                <span>{member.email || "-"}</span>
                <span>{member.phone_number || "-"}</span>
                <span>{member.role || "member"}</span>
                <span>{member.status || "active"}</span>
                <span>
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => handleEditMember(member)}
                  >
                    Edit
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="admin-card">
        <h3>Invite Codes</h3>
        {loadingInvites ? (
          <p>Loading invites...</p>
        ) : (
          <div className="admin-table">
            <div className="admin-table-row admin-table-head">
              <span>Email</span>
              <span>Role</span>
              <span>Status</span>
              <span>Code</span>
              <span>Expires</span>
              <span>Actions</span>
            </div>
            {invites.map((invite) => (
              <div className="admin-table-row" key={invite.id}>
                <span>{invite.email}</span>
                <span>{invite.role}</span>
                <span>{invite.status}</span>
                <span>{invite.code_prefix}</span>
                <span>
                  {invite.expires_at
                    ? new Date(invite.expires_at).toLocaleDateString()
                    : "-"}
                </span>
                <span>
                  {invite.status === "pending" ? (
                    <button
                      type="button"
                      className="link-button"
                      onClick={() => handleRevokeInvite(invite.id)}
                    >
                      Revoke
                    </button>
                  ) : (
                    "-"
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
