import { useState } from "react";
import DataModal from "./DataModal.jsx";
import ResponseModal from "./ResponseModal.jsx";
import { createMagicLinkInvite } from "../../lib/dataService.js";

export default function MembersPage({ tenantInfo }) {
  const rows = Array.from({ length: 6 });
  const feedItems = Array.from({ length: 4 });
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showResponseModal, setShowResponseModal] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    name: "",
    email: "",
    phone_number: "",
    role: "member",
    notes: "",
  });
  const [responseData, setResponseData] = useState({
    type: "success",
    title: "",
    message: "",
    code: null,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInviteChange = (e) => {
    const { name, value } = e.target;
    setInviteForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleInviteSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (!inviteForm.email.trim()) {
        setResponseData({
          type: "error",
          title: "Email Required",
          message: "Please enter an email address for the member.",
          code: null,
        });
        setShowResponseModal(true);
        setIsSubmitting(false);
        return;
      }

      const payload = {
        email: inviteForm.email,
        phone_number: inviteForm.phone_number || null,
        role: inviteForm.role || "member",
        notes: inviteForm.notes || null,
        tenant_id: tenantInfo?.id,
      };

      const result = await createMagicLinkInvite(payload);

      // Show success response with invite number
      setResponseData({
        type: "success",
        title: "Invite Created!",
        message: `Share this invite number with ${inviteForm.email}. They can use it to join the workspace.`,
        code: result?.inviteNumber,
      });
      setShowResponseModal(true);

      // Reset form
      setInviteForm({
        name: "",
        email: "",
        phone_number: "",
        role: "member",
        notes: "",
      });
    } catch (error) {
      setResponseData({
        type: "error",
        title: "Failed to Create Invite",
        message: error.message || "Something went wrong. Please try again.",
        code: null,
      });
      setShowResponseModal(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseModal = () => {
    setShowInviteModal(false);
    setInviteForm({
      name: "",
      email: "",
      phone_number: "",
      role: "member",
      notes: "",
    });
  };

  const handleCloseResponseModal = () => {
    setShowResponseModal(false);
  };

  return (
    <div className="members-shell">
      <section className="members-shell-card">
        <header className="members-shell-header">
          <div>
            <h2>Members</h2>
            <p>Member management UI scaffold is ready. Data wiring comes next.</p>
          </div>
          <div className="members-shell-actions">
            <button type="button" className="members-shell-btn members-shell-btn--ghost" disabled>
              Export
            </button>
            <button
              type="button"
              className="members-shell-btn members-shell-btn--primary"
              onClick={() => setShowInviteModal(true)}
            >
              Invite member
            </button>
          </div>
        </header>

        <div className="members-shell-grid">
          <article className="members-shell-panel members-shell-panel--table">
            <div className="members-shell-panel-header">
              <h3>Members list</h3>
              <span className="members-shell-chip">Coming soon</span>
            </div>

            <div className="members-shell-search" aria-hidden="true" />

            <div className="members-shell-table-head">
              <span>Name</span>
              <span>Role</span>
              <span>Status</span>
            </div>

            <div className="members-shell-table-body">
              {rows.map((_, index) => (
                <div className="members-shell-row" key={index}>
                  <span className="members-shell-line members-shell-line--name" />
                  <span className="members-shell-line members-shell-line--role" />
                  <span className="members-shell-line members-shell-line--status" />
                </div>
              ))}
            </div>
          </article>

          <aside className="members-shell-side">
            <article className="members-shell-panel">
              <div className="members-shell-panel-header">
                <h3>Activity feed</h3>
              </div>
              <div className="members-shell-feed">
                {feedItems.map((_, index) => (
                  <div className="members-shell-feed-item" key={index}>
                    <span className="members-shell-dot" />
                    <div className="members-shell-feed-lines">
                      <span className="members-shell-line members-shell-line--feed-title" />
                      <span className="members-shell-line members-shell-line--feed-meta" />
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <article className="members-shell-panel">
              <div className="members-shell-panel-header">
                <h3>Reminders</h3>
              </div>
              <div className="members-shell-calendar" aria-hidden="true" />
              <div className="members-shell-reminder-list">
                <span className="members-shell-line members-shell-line--reminder" />
                <span className="members-shell-line members-shell-line--reminder" />
              </div>
            </article>
          </aside>
        </div>
      </section>

      <DataModal
        open={showInviteModal}
        onClose={handleCloseModal}
        title="Invite member"
        subtitle="Send an invite and assign a role before they join."
        icon="mail"
      >
        <form className="data-modal-form" onSubmit={handleInviteSubmit}>
          <div className="data-modal-grid">
            <label className="data-modal-field">
              E-mail *
              <input
                type="email"
                name="email"
                value={inviteForm.email}
                onChange={handleInviteChange}
                placeholder="member@group.org"
                required
              />
            </label>
            <label className="data-modal-field">
              Phone number
              <input
                type="tel"
                name="phone_number"
                value={inviteForm.phone_number}
                onChange={handleInviteChange}
                placeholder="+254 700 000 000"
              />
            </label>
            <label className="data-modal-field">
              Role
              <select name="role" value={inviteForm.role} onChange={handleInviteChange}>
                <option value="member">Member</option>
                <option value="treasurer">Treasurer</option>
                <option value="secretary">Secretary</option>
                <option value="project_manager">Project Manager</option>
                <option value="admin">Admin</option>
              </select>
            </label>
            <label className="data-modal-field data-modal-field--full">
              Invite note (optional)
              <textarea
                rows="4"
                name="notes"
                value={inviteForm.notes}
                onChange={handleInviteChange}
                placeholder="Add a short welcome or role instructions."
              />
            </label>
          </div>
          <div className="data-modal-actions">
            <button
              type="button"
              className="data-modal-btn"
              onClick={handleCloseModal}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="data-modal-btn data-modal-btn--primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Sending..." : "Send invite"}
            </button>
          </div>
        </form>
      </DataModal>

      <ResponseModal
        open={showResponseModal}
        onClose={handleCloseResponseModal}
        type={responseData.type}
        title={responseData.title}
        message={responseData.message}
        code={responseData.code}
        codeLabel="Invite Number"
        onCopyCode={() => {
          navigator.clipboard.writeText(responseData.code);
        }}
      />
    </div>
  );
}
