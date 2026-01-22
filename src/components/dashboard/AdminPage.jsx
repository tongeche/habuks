import { useEffect, useMemo, useState } from "react";
import {
  createMemberAdmin,
  updateMemberAdmin,
  getMembersWithTotalWelfare,
  getMemberInvites,
  createMemberInvite,
  revokeMemberInvite,
  getWelfareAccounts,
  getWelfareCycles,
  getWelfareTransactionsAdmin,
  createWelfareTransaction,
  updateWelfareTransaction,
  deleteWelfareTransaction,
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

const initialWelfareForm = {
  member_id: "",
  welfare_account_id: "",
  cycle_id: "",
  amount: "",
  transaction_type: "contribution",
  status: "Completed",
  date: new Date().toISOString().slice(0, 10),
  description: "",
};

const adminModules = [
  {
    key: "members",
    title: "Members & Roles",
    description: "Add members, assign roles, and manage access.",
    icon: "users",
    sections: ["members-list"],
    tone: "emerald",
  },
  {
    key: "invites",
    title: "Invite Codes",
    description: "Create onboarding invites and revoke access.",
    icon: "mail",
    sections: ["invites-form", "invites-list"],
    tone: "blue",
  },
  {
    key: "projects",
    title: "Projects",
    description: "Create, assign leaders, and manage project status.",
    icon: "briefcase",
    tone: "violet",
  },
  {
    key: "finance",
    title: "Expenses & Sales",
    description: "Review project spend, sales, and approvals.",
    icon: "receipt",
    tone: "amber",
  },
  {
    key: "welfare",
    title: "Welfare Cycles",
    description: "Configure contributions, payouts, and balances.",
    icon: "wallet",
    sections: ["welfare-form", "welfare-list"],
    tone: "teal",
  },
  {
    key: "documents",
    title: "Documents",
    description: "Templates, downloads, and upload approvals.",
    icon: "folder",
    tone: "indigo",
  },
  {
    key: "news",
    title: "News & Updates",
    description: "Publish announcements and member updates.",
    icon: "newspaper",
    tone: "rose",
  },
  {
    key: "reports",
    title: "Reports & Insights",
    description: "Exports, KPIs, and performance summaries.",
    icon: "trending-up",
    tone: "cyan",
  },
  {
    key: "compliance",
    title: "Compliance",
    description: "Audit trails, approvals, and data checks.",
    icon: "check-circle",
    tone: "slate",
  },
  {
    key: "support",
    title: "Support Inbox",
    description: "Handle member issues and requests.",
    icon: "clock-alert",
    tone: "orange",
  },
];

export default function AdminPage({ user }) {
  const [members, setMembers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [memberForm, setMemberForm] = useState(initialMemberForm);
  const [inviteForm, setInviteForm] = useState(initialInviteForm);
  const [welfareForm, setWelfareForm] = useState(initialWelfareForm);
  const [selectedMemberId, setSelectedMemberId] = useState(null);
  const [selectedWelfareId, setSelectedWelfareId] = useState(null);
  const [generatedInvite, setGeneratedInvite] = useState(null);
  const [search, setSearch] = useState("");
  const [welfareSearch, setWelfareSearch] = useState("");
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [loadingInvites, setLoadingInvites] = useState(false);
  const [loadingWelfare, setLoadingWelfare] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [activeModule, setActiveModule] = useState(null);
  const [showMemberForm, setShowMemberForm] = useState(false);
  const [welfareTransactions, setWelfareTransactions] = useState([]);
  const [welfareAccounts, setWelfareAccounts] = useState([]);
  const [welfareCycles, setWelfareCycles] = useState([]);

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

  const filteredWelfareTransactions = useMemo(() => {
    if (!welfareSearch.trim()) {
      return welfareTransactions;
    }
    const query = welfareSearch.toLowerCase();
    return welfareTransactions.filter((txn) => {
      const memberName = txn.member?.name || "";
      const description = txn.description || "";
      const type = txn.transaction_type || "";
      return (
        memberName.toLowerCase().includes(query) ||
        description.toLowerCase().includes(query) ||
        type.toLowerCase().includes(query)
      );
    });
  }, [welfareTransactions, welfareSearch]);

  const welfareAccountMap = useMemo(() => {
    return new Map(welfareAccounts.map((account) => [account.id, account]));
  }, [welfareAccounts]);

  const welfareCycleMap = useMemo(() => {
    return new Map(welfareCycles.map((cycle) => [cycle.id, cycle]));
  }, [welfareCycles]);

  useEffect(() => {
    if (!isAdmin) {
      return;
    }
    loadMembers();
    loadInvites();
    loadWelfareMeta();
    loadWelfareTransactions();
  }, [isAdmin]);

  useEffect(() => {
    if (activeModule !== "members") {
      setShowMemberForm(false);
      setSelectedMemberId(null);
      setMemberForm(initialMemberForm);
    }
    if (activeModule !== "welfare") {
      setSelectedWelfareId(null);
      setWelfareForm(initialWelfareForm);
      setWelfareSearch("");
    }
  }, [activeModule]);

  useEffect(() => {
    if (!selectedWelfareId && welfareAccounts.length && !welfareForm.welfare_account_id) {
      setWelfareForm((prev) => ({
        ...prev,
        welfare_account_id: String(welfareAccounts[0].id),
      }));
    }
  }, [welfareAccounts, welfareForm.welfare_account_id, selectedWelfareId]);

  const loadMembers = async () => {
    setLoadingMembers(true);
    try {
      const data = await getMembersWithTotalWelfare();
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

  const loadWelfareMeta = async () => {
    try {
      const [accounts, cycles] = await Promise.all([getWelfareAccounts(), getWelfareCycles()]);
      setWelfareAccounts(accounts);
      setWelfareCycles(cycles);
    } catch (error) {
      setErrorMessage(error.message || "Failed to load welfare metadata.");
    }
  };

  const loadWelfareTransactions = async () => {
    setLoadingWelfare(true);
    try {
      const data = await getWelfareTransactionsAdmin();
      setWelfareTransactions(data);
    } catch (error) {
      setErrorMessage(error.message || "Failed to load welfare transactions.");
    } finally {
      setLoadingWelfare(false);
    }
  };

  const resetMessages = () => {
    setStatusMessage("");
    setErrorMessage("");
  };

  const handleModuleClick = (module) => {
    if (!module?.sections?.length) {
      return;
    }
    setActiveModule((prev) => (prev === module.key ? null : module.key));
  };

  const activeModuleConfig = adminModules.find((module) => module.key === activeModule);
  const activeSections = new Set(activeModuleConfig?.sections || []);

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

  const handleWelfareChange = (e) => {
    const { name, value } = e.target;
    setWelfareForm((prev) => ({ ...prev, [name]: value }));
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
      setShowMemberForm(false);
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
    setShowMemberForm(true);
    resetMessages();
  };

  const handleMemberCancel = () => {
    setMemberForm(initialMemberForm);
    setSelectedMemberId(null);
    setShowMemberForm(false);
    resetMessages();
  };

  const handleNewMember = () => {
    setMemberForm(initialMemberForm);
    setSelectedMemberId(null);
    setShowMemberForm(true);
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

  const handleWelfareSubmit = async (e) => {
    e.preventDefault();
    resetMessages();

    const amountValue = Number.parseFloat(welfareForm.amount);
    if (!Number.isFinite(amountValue)) {
      setErrorMessage("Amount is required.");
      return;
    }

    if (!welfareForm.date) {
      setErrorMessage("Transaction date is required.");
      return;
    }

    const payload = {
      welfare_account_id: welfareForm.welfare_account_id
        ? Number.parseInt(welfareForm.welfare_account_id, 10)
        : null,
      cycle_id: welfareForm.cycle_id ? Number.parseInt(welfareForm.cycle_id, 10) : null,
      member_id: welfareForm.member_id ? Number.parseInt(welfareForm.member_id, 10) : null,
      amount: amountValue,
      transaction_type: welfareForm.transaction_type,
      status: welfareForm.status,
      date: welfareForm.date,
      description: welfareForm.description,
    };

    try {
      if (selectedWelfareId) {
        await updateWelfareTransaction(selectedWelfareId, payload);
        setStatusMessage("Welfare transaction updated.");
      } else {
        await createWelfareTransaction(payload);
        setStatusMessage("Welfare transaction recorded.");
      }

      setWelfareForm({
        ...initialWelfareForm,
        welfare_account_id:
          welfareForm.welfare_account_id ||
          (welfareAccounts[0] ? String(welfareAccounts[0].id) : ""),
      });
      setSelectedWelfareId(null);
      await loadWelfareTransactions();
      await loadMembers();
    } catch (error) {
      setErrorMessage(error.message || "Failed to save welfare transaction.");
    }
  };

  const handleEditWelfare = (transaction) => {
    setWelfareForm({
      member_id: transaction.member_id ? String(transaction.member_id) : "",
      welfare_account_id: transaction.welfare_account_id
        ? String(transaction.welfare_account_id)
        : "",
      cycle_id: transaction.cycle_id ? String(transaction.cycle_id) : "",
      amount: transaction.amount ?? "",
      transaction_type: transaction.transaction_type || "contribution",
      status: transaction.status || "Completed",
      date: transaction.date ? String(transaction.date).slice(0, 10) : initialWelfareForm.date,
      description: transaction.description || "",
    });
    setSelectedWelfareId(transaction.id);
    resetMessages();
  };

  const handleWelfareCancel = () => {
    setWelfareForm({
      ...initialWelfareForm,
      welfare_account_id: welfareAccounts[0] ? String(welfareAccounts[0].id) : "",
    });
    setSelectedWelfareId(null);
    resetMessages();
  };

  const handleDeleteWelfare = async (transactionId) => {
    if (!transactionId) {
      return;
    }
    if (!window.confirm("Delete this welfare transaction? This cannot be undone.")) {
      return;
    }
    resetMessages();
    try {
      await deleteWelfareTransaction(transactionId);
      setStatusMessage("Welfare transaction deleted.");
      await loadWelfareTransactions();
      await loadMembers();
    } catch (error) {
      setErrorMessage(error.message || "Failed to delete welfare transaction.");
    }
  };

  const formatWelfareAmount = (amount) => {
    const numericAmount =
      typeof amount === "string" ? Number.parseFloat(amount) : Number(amount);
    if (!Number.isFinite(numericAmount)) {
      return "-";
    }
    return numericAmount.toLocaleString("en-KE", {
      style: "currency",
      currency: "KES",
      maximumFractionDigits: 0,
    });
  };

  const formatWelfareDate = (date) => {
    if (!date) {
      return "-";
    }
    return new Date(date).toLocaleDateString("en-KE", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
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

  // Get first 5 modules for mobile nav (most commonly used)
  const mobileNavModules = adminModules.filter(m => m.sections?.length).slice(0, 5);

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <div className="admin-search admin-search--top">
          <Icon name="search" size={16} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search members, invites, email or phone"
          />
        </div>
      </div>

      {(statusMessage || errorMessage) && (
        <div className={`admin-alert ${errorMessage ? "is-error" : "is-success"}`}>
          <span>{errorMessage || statusMessage}</span>
        </div>
      )}

      {!activeModule && (
        <div className="admin-card admin-launchpad">
          <div className="admin-launchpad-header">
            <div>
              <h3>Admin Shortcuts</h3>
              <p className="admin-help">
                Quick access to the most common admin tools and workflows.
              </p>
            </div>
          </div>
          <div className="admin-launchpad-grid">
            {adminModules.map((module) => {
              const isEnabled = Boolean(module.sections?.length);
              const isOpen = isEnabled && activeModule === module.key;
              return (
                <button
                  key={module.key}
                  type="button"
                  className={`admin-launchpad-card${isEnabled ? "" : " is-disabled"}${
                    isOpen ? " is-open" : ""
                  }`}
                  onClick={() => handleModuleClick(module)}
                  disabled={!isEnabled}
                  aria-disabled={!isEnabled}
                >
                  <span className={`admin-launchpad-icon tone-${module.tone || "emerald"}`}>
                    <Icon name={module.icon} size={20} />
                  </span>
                  <span className="admin-launchpad-content">
                    <span className="admin-launchpad-title">{module.title}</span>
                    <span className="admin-launchpad-desc">{module.description}</span>
                    <span className="admin-launchpad-meta">
                      {isEnabled ? (isOpen ? "Focused" : "Open") : "Coming soon"}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          <p className="admin-launchpad-note">
            Select a tile to open its tools below.
          </p>
        </div>
      )}

      {(showMemberForm || activeSections.has("invites-form") || activeSections.has("welfare-form")) && (
        <div className="admin-grid">
          {showMemberForm && (
            <div className="admin-card" id="admin-members">
              <div className="admin-card-header">
                <h3>{selectedMemberId ? "Edit Member" : "Create Member"}</h3>
                <button
                  type="button"
                  className="link-button admin-card-dismiss"
                  onClick={() => setShowMemberForm(false)}
                >
                  Back to list
                </button>
              </div>
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
                      <option value="project_manager">Project Manager</option>
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
          )}

          {activeSections.has("invites-form") && (
            <div className="admin-card" id="admin-invites">
              <div className="admin-card-header">
                <h3>Generate Invite Code</h3>
                <button
                  type="button"
                  className="link-button admin-card-dismiss"
                  onClick={() => setActiveModule(null)}
                >
                  Back to console
                </button>
              </div>
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
                      <option value="project_manager">Project Manager</option>
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
          )}

          {activeSections.has("welfare-form") && (
            <div className="admin-card" id="admin-welfare">
              <div className="admin-card-header">
                <h3>{selectedWelfareId ? "Edit Welfare Transaction" : "Record Welfare Transaction"}</h3>
                <button
                  type="button"
                  className="link-button admin-card-dismiss"
                  onClick={() => setActiveModule(null)}
                >
                  Back to console
                </button>
              </div>
              <p className="admin-help">
                Log contributions, disbursements, or adjustments. Member totals update automatically
                from recorded transactions.
              </p>
              <form className="admin-form" onSubmit={handleWelfareSubmit}>
                <div className="admin-form-grid">
                  <div className="admin-form-field">
                    <label>Member</label>
                    <select
                      name="member_id"
                      value={welfareForm.member_id}
                      onChange={handleWelfareChange}
                    >
                      <option value="">Group Welfare (no member)</option>
                      {members.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.name || member.email || `Member #${member.id}`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="admin-form-field">
                    <label>Amount *</label>
                    <input
                      name="amount"
                      type="number"
                      step="0.01"
                      value={welfareForm.amount}
                      onChange={handleWelfareChange}
                      placeholder="1000"
                    />
                  </div>
                  <div className="admin-form-field">
                    <label>Transaction Type</label>
                    <select
                      name="transaction_type"
                      value={welfareForm.transaction_type}
                      onChange={handleWelfareChange}
                    >
                      <option value="contribution">Contribution</option>
                      <option value="disbursement">Disbursement</option>
                      <option value="emergency">Emergency</option>
                      <option value="support">Support</option>
                      <option value="adjustment">Adjustment</option>
                    </select>
                  </div>
                  <div className="admin-form-field">
                    <label>Status</label>
                    <select name="status" value={welfareForm.status} onChange={handleWelfareChange}>
                      <option value="Pending">Pending</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Completed">Completed</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                  </div>
                  <div className="admin-form-field">
                    <label>Date *</label>
                    <input
                      type="date"
                      name="date"
                      value={welfareForm.date}
                      onChange={handleWelfareChange}
                    />
                  </div>
                  <div className="admin-form-field">
                    <label>Cycle</label>
                    <select name="cycle_id" value={welfareForm.cycle_id} onChange={handleWelfareChange}>
                      <option value="">Select cycle</option>
                      {welfareCycles.map((cycle) => (
                        <option key={cycle.id} value={cycle.id}>
                          Cycle {cycle.cycle_number}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="admin-form-field">
                    <label>Welfare Account</label>
                    <select
                      name="welfare_account_id"
                      value={welfareForm.welfare_account_id}
                      onChange={handleWelfareChange}
                    >
                      <option value="">Select account</option>
                      {welfareAccounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="admin-form-field admin-form-field--full">
                    <label>Description</label>
                    <textarea
                      name="description"
                      value={welfareForm.description}
                      onChange={handleWelfareChange}
                      placeholder="Optional note about this welfare entry"
                      rows={3}
                    />
                  </div>
                </div>
                <div className="admin-form-actions">
                  <button className="btn-primary" type="submit">
                    {selectedWelfareId ? "Save Changes" : "Record Transaction"}
                  </button>
                  {selectedWelfareId && (
                    <button className="btn-secondary" type="button" onClick={handleWelfareCancel}>
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {activeSections.has("members-list") && (
        <div className="admin-card" id="admin-members-list">
          <div className="admin-card-header">
            <h3>Members</h3>
            <div className="admin-card-actions desktop-only">
              <button type="button" className="btn-primary small" onClick={handleNewMember}>
                <Icon name="plus" size={16} />
                New Member
              </button>
              <button
                type="button"
                className="link-button admin-card-dismiss"
                onClick={() => setActiveModule(null)}
              >
                Back to console
              </button>
            </div>
          </div>
          {loadingMembers ? (
            <p>Loading members...</p>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="admin-table desktop-only">
                <div className="admin-table-row admin-table-head">
                  <span>Name</span>
                  <span>Email</span>
                  <span>Phone</span>
                  <span>Role</span>
                  <span>Status</span>
                  <span>Total Welfare</span>
                  <span>Actions</span>
                </div>
                {filteredMembers.map((member) => (
                  <div className="admin-table-row" key={member.id}>
                    <span>{member.name}</span>
                    <span>{member.email || "-"}</span>
                    <span>{member.phone_number || "-"}</span>
                    <span>{member.role || "member"}</span>
                    <span>{member.status || "active"}</span>
                    <span>{typeof member.total_welfare === 'number' ? member.total_welfare.toLocaleString('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 }) : '-'}</span>
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
              {/* Mobile List View */}
              <div className="members-list-mobile mobile-only">
                {filteredMembers.map((member) => (
                  <div className="member-list-item" key={member.id}>
                    <div className="member-list-main" onClick={() => handleEditMember(member)}>
                      <div className="member-avatar">
                        {member.name ? member.name.charAt(0).toUpperCase() : <Icon name="user" size={18} />}
                      </div>
                      <div className="member-list-info">
                        <div className="member-list-name">{member.name}</div>
                        <div className="member-list-role">{member.role || "member"}</div>
                        <div className="member-list-phone">{member.phone_number || "-"}</div>
                        <div className="member-list-welfare">
                          <span className="welfare-label">Total Welfare:</span>
                          <span className="welfare-value">{typeof member.total_welfare === 'number' ? member.total_welfare.toLocaleString('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 }) : '-'}</span>
                        </div>
                      </div>
                      <button className="member-list-edit" onClick={e => { e.stopPropagation(); handleEditMember(member); }}>
                        <Icon name="edit" size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          {/* Sticky action bar for mobile */}
          <div className="members-mobile-actionbar mobile-only">
            <button className="btn-primary" onClick={handleNewMember}>
              <Icon name="plus" size={18} /> Add Member
            </button>
            <button className="btn-secondary">
              <Icon name="filter" size={18} /> Filter
            </button>
          </div>
        </div>
      )}

      {activeSections.has("invites-list") && (
        <div className="admin-card" id="admin-invite-list">
          <div className="admin-card-header">
            <h3>Invite Codes</h3>
            <button
              type="button"
              className="link-button admin-card-dismiss"
              onClick={() => setActiveModule(null)}
            >
              Back to console
            </button>
          </div>
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
      )}

      {activeSections.has("welfare-list") && (
        <div className="admin-card" id="admin-welfare-list">
          <div className="admin-card-header">
            <h3>Welfare Transactions</h3>
            <button
              type="button"
              className="link-button admin-card-dismiss"
              onClick={() => setActiveModule(null)}
            >
              Back to console
            </button>
          </div>
          <div className="admin-list-header">
            <div className="admin-search">
              <Icon name="search" size={16} />
              <input
                value={welfareSearch}
                onChange={(e) => setWelfareSearch(e.target.value)}
                placeholder="Search welfare transactions"
              />
            </div>
            <div className="admin-card-actions">
              <button className="btn-secondary small" type="button" onClick={handleWelfareCancel}>
                Clear Form
              </button>
            </div>
          </div>
          {loadingWelfare ? (
            <p>Loading welfare transactions...</p>
          ) : filteredWelfareTransactions.length === 0 ? (
            <p className="admin-help">No welfare transactions found.</p>
          ) : (
            <div className="admin-table admin-table--welfare">
              <div className="admin-table-row admin-table-head">
                <span>Date</span>
                <span>Member</span>
                <span>Type</span>
                <span>Amount</span>
                <span>Status</span>
                <span>Actions</span>
              </div>
              {filteredWelfareTransactions.map((transaction) => {
                const cycle = welfareCycleMap.get(transaction.cycle_id);
                const account = welfareAccountMap.get(transaction.welfare_account_id);
                return (
                  <div className="admin-table-row" key={transaction.id}>
                    <span>{formatWelfareDate(transaction.date)}</span>
                    <span>{transaction.member?.name || "Group Welfare"}</span>
                    <span>
                      {(transaction.transaction_type || "contribution").replace(/_/g, " ")}
                      {(transaction.description || cycle || account) && (
                        <span className="admin-table-subtext">
                          {transaction.description
                            ? transaction.description
                            : cycle
                            ? `Cycle ${cycle.cycle_number}`
                            : account?.name}
                        </span>
                      )}
                    </span>
                    <span>{formatWelfareAmount(transaction.amount)}</span>
                    <span>{transaction.status || "Completed"}</span>
                    <span className="admin-table-actions">
                      <button
                        type="button"
                        className="link-button"
                        onClick={() => handleEditWelfare(transaction)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="link-button is-danger"
                        onClick={() => handleDeleteWelfare(transaction.id)}
                      >
                        Delete
                      </button>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Mobile Bottom Navigation */}
      <div className="admin-mobile-nav">
        <button
          type="button"
          className={`admin-mobile-nav-btn ${!activeModule ? 'active' : ''}`}
          onClick={() => setActiveModule(null)}
        >
          <Icon name="home" size={20} />
          <span>Home</span>
        </button>
        {mobileNavModules.map((module) => (
          <button
            key={module.key}
            type="button"
            className={`admin-mobile-nav-btn ${activeModule === module.key ? 'active' : ''}`}
            onClick={() => handleModuleClick(module)}
          >
            <Icon name={module.icon} size={20} />
            <span>{module.title.split(' ')[0]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
