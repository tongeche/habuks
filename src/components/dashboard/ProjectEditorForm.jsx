import { useEffect, useRef } from "react";
import { Icon } from "../icons.jsx";

const noop = () => {};

const toArray = (value) => (Array.isArray(value) ? value : []);

const defaultFingerprint = (file) => {
  const name = String(file?.name || "file");
  const size = Number(file?.size || 0);
  const modified = Number(file?.lastModified || 0);
  return `${name}-${size}-${modified}`;
};

const defaultFileSize = (size) => {
  const bytes = Number(size || 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
};

const joinClassNames = (...classes) => classes.filter(Boolean).join(" ");

const PROJECT_EDITOR_STEPS = [
  {
    key: "info",
    label: "Project info",
    mobileLabel: "Project",
    note: "Name, category, dates, and status.",
    icon: "briefcase",
  },
  {
    key: "budget",
    label: "Budget & finance",
    mobileLabel: "Budget",
    note: "Budget, revenue targets, and funding.",
    icon: "wallet",
  },
  {
    key: "members",
    label: "Contacts & members",
    mobileLabel: "Team",
    note: "Primary contact and project members.",
    icon: "users",
  },
  {
    key: "media",
    label: "Media",
    mobileLabel: "Media",
    note: "Project images and uploaded files.",
    icon: "folder",
  },
];

const getDefaultForm = () => ({
  name: "",
  moduleKey: "generic",
  startDate: "",
  status: "active",
  summary: "",
  totalBudget: "",
  expectedRevenue: "",
  fundingSource: "member_contributions",
  payoutSchedule: "monthly",
  budgetNotes: "",
  primaryContactId: "",
  primaryContactRole: "Project lead",
  memberToAddId: "",
});

function ProjectEditorForm({
  activeTab = "info",
  onTabChange = noop,
  form,
  onFieldChange = noop,
  createProjectError = "",
  onSubmit,
  onCancel = noop,
  creatingProject = false,
  isEditingProject = false,
  membersLoading = false,
  memberDirectory = [],
  primaryContact = null,
  selectedMemberOptions = [],
  selectedAdditionalMembers = [],
  onAddMemberSelection = noop,
  onRemoveSelectedMember = noop,
  selectedExistingMedia = [],
  onRemoveExistingMedia = noop,
  onMediaFileSelection = noop,
  selectedMediaFiles = [],
  onRemoveMediaFile = noop,
  getFileFingerprint = defaultFingerprint,
  formatFileSize = defaultFileSize,
  fieldClassNames = {},
  className = "",
}) {
  const safeForm = { ...getDefaultForm(), ...(form || {}) };
  const stepRefs = useRef({});
  const activeStepIndex = Math.max(
    0,
    PROJECT_EDITOR_STEPS.findIndex((step) => step.key === activeTab)
  );
  const activeStep = PROJECT_EDITOR_STEPS[activeStepIndex] || PROJECT_EDITOR_STEPS[0];

  const handleSubmit = (event) => {
    if (typeof onSubmit === "function") {
      onSubmit(event);
      return;
    }
    event.preventDefault();
  };

  const getFieldClass = (field) => fieldClassNames?.[field] || "";

  useEffect(() => {
    const activeNode = stepRefs.current?.[activeStep.key];
    if (!activeNode || typeof activeNode.scrollIntoView !== "function") return;
    activeNode.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [activeStep.key]);

  return (
    <form className={joinClassNames("data-modal-form", "project-editor-form", className)} onSubmit={handleSubmit}>
      <div className="project-editor-step-shell">
        <div className="project-editor-step-meta">
          <div>
            <span className="project-editor-step-kicker">
              Step {activeStepIndex + 1} of {PROJECT_EDITOR_STEPS.length}
            </span>
            <p>{activeStep.note}</p>
          </div>
          <span className="project-editor-step-counter" aria-hidden="true">
            {activeStepIndex + 1}/{PROJECT_EDITOR_STEPS.length}
          </span>
        </div>

        <div className="data-modal-tabs project-editor-stepper" role="tablist" aria-label="Project form steps">
          {PROJECT_EDITOR_STEPS.map((step, index) => {
            const isActive = activeTab === step.key;
            const isComplete = activeStepIndex > index;

            return (
              <button
                key={step.key}
                ref={(node) => {
                  if (node) {
                    stepRefs.current[step.key] = node;
                  } else {
                    delete stepRefs.current[step.key];
                  }
                }}
                type="button"
                className={joinClassNames(
                  "data-modal-tab",
                  "project-editor-step",
                  isActive ? "active is-active" : "",
                  isComplete ? "is-complete" : "",
                  getFieldClass(`tab:${step.key}`)
                )}
                onClick={() => onTabChange(step.key)}
                role="tab"
                aria-selected={isActive}
                data-demo-tab={step.key}
              >
                <span className="project-editor-step-badge" aria-hidden="true">
                  {isComplete ? <Icon name="check" size={14} /> : <Icon name={step.icon} size={14} />}
                </span>
                <span className="project-editor-step-copy">
                  <strong>
                    <span className="project-editor-step-label project-editor-step-label--desktop">
                      {step.label}
                    </span>
                    <span className="project-editor-step-label project-editor-step-label--mobile">
                      {step.mobileLabel}
                    </span>
                  </strong>
                  <small>{step.note}</small>
                </span>
              </button>
            );
          })}
        </div>

        <div className="project-editor-step-progress" aria-hidden="true">
          <span style={{ width: `${((activeStepIndex + 1) / PROJECT_EDITOR_STEPS.length) * 100}%` }} />
        </div>
      </div>

      {createProjectError ? (
        <p className="data-modal-feedback data-modal-feedback--error">{createProjectError}</p>
      ) : null}

      {activeTab === "info" && (
        <div className="data-modal-grid">
          <label className="data-modal-field">
            Project name
            <input
              type="text"
              placeholder="e.g. Community Poultry Project"
              value={safeForm.name}
              onChange={(event) => onFieldChange("name", event.target.value)}
              className={getFieldClass("name")}
              data-demo-field="name"
              required
            />
          </label>
          <label className="data-modal-field">
            Category
            <select
              value={safeForm.moduleKey}
              onChange={(event) => onFieldChange("moduleKey", event.target.value)}
              className={getFieldClass("moduleKey")}
              data-demo-field="moduleKey"
            >
              <option value="generic">Agriculture</option>
              <option value="jpp">Poultry (JPP)</option>
              <option value="jgf">Groundnut (JGF)</option>
            </select>
          </label>
          <label className="data-modal-field">
            Start date
            <input
              type="date"
              value={safeForm.startDate}
              onChange={(event) => onFieldChange("startDate", event.target.value)}
              className={getFieldClass("startDate")}
              data-demo-field="startDate"
            />
          </label>
          <label className="data-modal-field">
            Status
            <select
              value={safeForm.status}
              onChange={(event) => onFieldChange("status", event.target.value)}
              className={getFieldClass("status")}
              data-demo-field="status"
            >
              <option value="active">Active</option>
              <option value="planning">Planning</option>
              <option value="completed">Completed</option>
            </select>
          </label>
          <label className="data-modal-field data-modal-field--full">
            Summary
            <textarea
              rows="4"
              placeholder="Describe the project goals and outcomes."
              value={safeForm.summary}
              onChange={(event) => onFieldChange("summary", event.target.value)}
              className={getFieldClass("summary")}
              data-demo-field="summary"
            />
          </label>
        </div>
      )}

      {activeTab === "budget" && (
        <div className="data-modal-grid">
          <label className="data-modal-field">
            Total budget (KSh)
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="120000"
              value={safeForm.totalBudget}
              onChange={(event) => onFieldChange("totalBudget", event.target.value)}
              className={getFieldClass("totalBudget")}
            />
          </label>
          <label className="data-modal-field">
            Expected revenue (KSh)
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="240000"
              value={safeForm.expectedRevenue}
              onChange={(event) => onFieldChange("expectedRevenue", event.target.value)}
              className={getFieldClass("expectedRevenue")}
            />
          </label>
          <label className="data-modal-field">
            Funding source
            <select
              value={safeForm.fundingSource}
              onChange={(event) => onFieldChange("fundingSource", event.target.value)}
              className={getFieldClass("fundingSource")}
            >
              <option value="member_contributions">Member contributions</option>
              <option value="grant">Grant</option>
              <option value="loan">Loan</option>
              <option value="mixed">Mixed</option>
            </select>
          </label>
          <label className="data-modal-field">
            Payout schedule
            <select
              value={safeForm.payoutSchedule}
              onChange={(event) => onFieldChange("payoutSchedule", event.target.value)}
              className={getFieldClass("payoutSchedule")}
            >
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="on_completion">On completion</option>
            </select>
          </label>
          <label className="data-modal-field data-modal-field--full">
            Notes
            <textarea
              rows="4"
              placeholder="Add financial notes or constraints."
              value={safeForm.budgetNotes}
              onChange={(event) => onFieldChange("budgetNotes", event.target.value)}
              className={getFieldClass("budgetNotes")}
            />
          </label>
        </div>
      )}

      {activeTab === "members" && (
        <div className="data-modal-grid">
          <label className="data-modal-field">
            Primary contact
            <select
              value={safeForm.primaryContactId}
              onChange={(event) => onFieldChange("primaryContactId", event.target.value)}
              disabled={membersLoading}
              className={getFieldClass("primaryContactId")}
            >
              <option value="">{membersLoading ? "Loading members..." : "Select member"}</option>
              {toArray(memberDirectory).map((member) => (
                <option key={member.id} value={String(member.id)}>
                  {member.name}
                </option>
              ))}
            </select>
          </label>
          <label className="data-modal-field">
            Contact email
            <input
              type="email"
              placeholder="name@email.com"
              value={primaryContact?.email || ""}
              readOnly
              className={getFieldClass("primaryContactEmail")}
            />
          </label>
          <label className="data-modal-field">
            Phone number
            <input
              type="tel"
              placeholder="+254 700 000 000"
              value={primaryContact?.phone_number || ""}
              readOnly
              className={getFieldClass("primaryContactPhone")}
            />
          </label>
          <label className="data-modal-field">
            Role
            <select
              value={safeForm.primaryContactRole}
              onChange={(event) => onFieldChange("primaryContactRole", event.target.value)}
              className={getFieldClass("primaryContactRole")}
            >
              <option value="Project lead">Project lead</option>
              <option value="Finance">Finance</option>
              <option value="Operations">Operations</option>
            </select>
          </label>
          <label className="data-modal-field data-modal-field--full">
            Add members
            <div className="data-modal-member-add">
              <select
                value={safeForm.memberToAddId}
                onChange={(event) => onFieldChange("memberToAddId", event.target.value)}
                disabled={membersLoading || !toArray(selectedMemberOptions).length}
                className={getFieldClass("memberToAddId")}
              >
                <option value="">
                  {membersLoading
                    ? "Loading members..."
                    : toArray(selectedMemberOptions).length
                      ? "Select member to add"
                      : "No more members to add"}
                </option>
                {toArray(selectedMemberOptions).map((member) => (
                  <option key={member.id} value={String(member.id)}>
                    {member.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={onAddMemberSelection}
                disabled={!safeForm.memberToAddId}
                className={getFieldClass("addMember")}
              >
                Add
              </button>
            </div>
          </label>
          <div className="data-modal-field data-modal-field--full">
            <div className="data-modal-member-list">
              {primaryContact ? (
                <span className="member-chip">
                  {primaryContact.name} ({safeForm.primaryContactRole || "Project lead"})
                </span>
              ) : null}
              {toArray(selectedAdditionalMembers).map((member) => (
                <span className="member-chip" key={`selected-member-${member.id}`}>
                  {member.name} (Member)
                  <button
                    type="button"
                    className="member-chip-remove"
                    onClick={() => onRemoveSelectedMember(member.id)}
                    aria-label={`Remove ${member.name}`}
                  >
                    {"\u00D7"}
                  </button>
                </span>
              ))}
              {!primaryContact && toArray(selectedAdditionalMembers).length === 0 ? (
                <span className="member-chip member-chip--empty">No members selected</span>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {activeTab === "media" && (
        <div className="data-modal-grid">
          <div className="data-modal-field data-modal-field--full">
            <div className="data-modal-upload-grid">
              {toArray(selectedExistingMedia).length === 0 ? (
                <div className="upload-thumb upload-thumb--empty">No existing media</div>
              ) : (
                toArray(selectedExistingMedia).map((item, index) => (
                  <div className="upload-thumb upload-thumb--existing" key={`existing-media-${item.id}`}>
                    <div className="upload-thumb-preview">
                      <img
                        src={item.image_url}
                        alt={item.caption || `Project media ${index + 1}`}
                        loading="lazy"
                      />
                    </div>
                    <strong>{index === 0 ? "Current cover" : `Current media ${index + 1}`}</strong>
                    <span>{item.caption || "Project media"}</span>
                    <button
                      type="button"
                      className="upload-thumb-remove"
                      onClick={() => onRemoveExistingMedia(item.id)}
                    >
                      Remove
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
          <label className="data-modal-field data-modal-field--full">
            Upload project images
            <div className="data-modal-upload">
              <input type="file" accept="image/*" multiple onChange={onMediaFileSelection} />
              <p>Add one or more images for this project. New images will appear after you save your changes.</p>
            </div>
          </label>
          <div className="data-modal-field data-modal-field--full">
            <div className="data-modal-upload-grid">
              {toArray(selectedMediaFiles).length === 0 ? (
                <div className="upload-thumb upload-thumb--empty">No new files selected</div>
              ) : (
                toArray(selectedMediaFiles).map((file, index) => (
                  <div className="upload-thumb upload-thumb--file" key={getFileFingerprint(file)}>
                    <strong>{index === 0 ? "New image 1" : `New image ${index + 1}`}</strong>
                    <span>{file.name}</span>
                    <small>{formatFileSize(file.size)}</small>
                    <button
                      type="button"
                      className="upload-thumb-remove"
                      onClick={() => onRemoveMediaFile(getFileFingerprint(file))}
                    >
                      Remove
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <div className="data-modal-actions">
        <button
          type="button"
          className={joinClassNames("data-modal-btn", getFieldClass("cancel"))}
          onClick={onCancel}
          disabled={creatingProject}
        >
          Cancel
        </button>
        <button
          type="submit"
          className={joinClassNames("data-modal-btn", "data-modal-btn--primary", getFieldClass("submit"))}
          disabled={creatingProject}
          data-demo-field="submit"
        >
          {creatingProject
            ? isEditingProject
              ? "Saving..."
              : "Creating..."
            : isEditingProject
              ? "Save changes"
              : "Create project"}
        </button>
      </div>
    </form>
  );
}

export { ProjectEditorForm };
export default ProjectEditorForm;
