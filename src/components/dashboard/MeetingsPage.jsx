import { useEffect, useMemo, useState } from "react";
import { getMeetings, createOrganizationActivity, updateOrganizationActivity, getMembersAdmin, getWelfareSummary, getEventSubscribers, createEventSubscriber } from "../../lib/dataService.js";
import { Icon } from "../icons.jsx";
import DataModal from "./DataModal.jsx";

export default function MeetingsPage({ user, tenantId }) {
  const [meetings, setMeetings] = useState([]);
  const [members, setMembers] = useState([]);
  const [welfareSummary, setWelfareSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddActivityModal, setShowAddActivityModal] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [activityTab, setActivityTab] = useState("details");
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    type: "General",
    date: new Date().toISOString().split("T")[0],
    description: "",
    status: "scheduled",
    location: "",
    agenda: "",
    assignees: [],
    attendees: [],
  });
  const [eventSubscribers, setEventSubscribers] = useState([]);
  const [showNewSubscriberForm, setShowNewSubscriberForm] = useState(false);
  const [newSubscriber, setNewSubscriber] = useState({ name: "", email: "", contact: "" });

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [meetingsData, membersData, welfareData, subscribersData] = await Promise.all([
          getMeetings(tenantId),
          getMembersAdmin(tenantId),
          getWelfareSummary(tenantId),
          getEventSubscribers(tenantId),
        ]);
        setMeetings(meetingsData || []);
        setMembers(membersData || []);
        setWelfareSummary(welfareData || null);
        setEventSubscribers(subscribersData || []);
      } catch (error) {
        console.error("Error loading data:", error);
        setMeetings([]);
        setMembers([]);
        setWelfareSummary(null);
        setEventSubscribers([]);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [tenantId]);

  const getStatus = (meetingDate) => {
    if (!meetingDate) return "Scheduled";
    const today = new Date();
    const meeting = new Date(meetingDate);
    if (meeting.toDateString() === today.toDateString()) return "Today";
    return meeting < today ? "Completed" : "Upcoming";
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-KE", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleToggleAssignee = (memberId) => {
    setFormData((prev) => {
      const assignees = prev.assignees || [];
      const isSelected = assignees.includes(memberId);
      return {
        ...prev,
        assignees: isSelected
          ? assignees.filter((id) => id !== memberId)
          : [...assignees, memberId],
      };
    });
  };

  const handleToggleAttendee = (attendeeId, type = "member") => {
    setFormData((prev) => {
      const attendees = prev.attendees || [];
      const attendeeKey = `${type}:${attendeeId}`;
      const isSelected = attendees.includes(attendeeKey);
      return {
        ...prev,
        attendees: isSelected
          ? attendees.filter((id) => id !== attendeeKey)
          : [...attendees, attendeeKey],
      };
    });
  };

  const handleAddNewSubscriber = async () => {
    if (!newSubscriber.name.trim() || !newSubscriber.email.trim()) {
      alert("Name and email are required");
      return;
    }

    try {
      const subscriber = await createEventSubscriber(newSubscriber, tenantId);
      setEventSubscribers((prev) => [...prev, subscriber]);
      setNewSubscriber({ name: "", email: "", contact: "" });
      setShowNewSubscriberForm(false);
      // Auto-select the new subscriber as an attendee
      handleToggleAttendee(subscriber.id, "subscriber");
    } catch (error) {
      console.error("Error creating subscriber:", error);
      alert(`Error creating subscriber: ${error.message}`);
    }
  };

  const handleSubmitActivity = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      alert("Activity title is required");
      return;
    }

    setSubmitting(true);
    try {
      const activityPayload = {
        title: formData.title,
        agenda: formData.agenda || formData.title,
        type: formData.type,
        date: formData.date,
        description: formData.description,
        location: formData.location,
        status: formData.status,
        assignees: formData.assignees || [],
        attendees: formData.attendees || [],
      };

      if (selectedActivity) {
        // Update existing activity
        await updateOrganizationActivity(selectedActivity.id, activityPayload, tenantId);
      } else {
        // Create new activity
        await createOrganizationActivity(activityPayload, tenantId);
      }

      // Reset form and reload meetings
      setFormData({
        title: "",
        type: "General",
        date: new Date().toISOString().split("T")[0],
        description: "",
        status: "scheduled",
        location: "",
        agenda: "",
        assignees: [],
        attendees: [],
      });
      setSelectedActivity(null);
      setActivityTab("details");
      setShowAddActivityModal(false);

      // Reload meetings
      const data = await getMeetings(tenantId);
      setMeetings(data || []);
    } catch (error) {
      console.error("Error saving activity:", error);
      alert(`Error saving activity: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const activityItems = useMemo(() => {
    return (meetings || []).map((m) => {
      const meetingDate = m.date || m.meeting_date || m.created_at;
      const status = m.status || getStatus(meetingDate);
      return {
        id: m.id,
        title: m.title || m.agenda || m.type || "Untitled Activity",
        category: m.type || "Activity",
        date: meetingDate,
        description: m.description || "",
        location: m.location || "",
        status: status,
        assignees: m.assignees || [],
        attendees: m.attendees || [],
      };
    });
  }, [meetings]);

  if (loading) {
    return <div className="meetings-page loading">Loading meetings...</div>;
  }

  return (
    <div className="activities-page">
      <div className="activities-header activities-header--actions">
        <button
          type="button"
          className="activities-add-btn"
          onClick={() => {
            setActivityTab("details");
            setShowAddActivityModal(true);
          }}
        >
          <Icon name="plus" size={16} />
          Add activity
        </button>
      </div>

      <div className="activities-stats">
        <div className="activities-stats-main">
          <div className="activities-stat-card">
            <p>Welfare Fund Balance</p>
            <h3>+ KES {(welfareSummary?.currentBalance || 0).toLocaleString("en-KE")}</h3>
          </div>
          <div className="activities-stat-card">
            <p>Total Activities</p>
            <h3>{meetings.length}</h3>
          </div>
        </div>
        <div className="activities-stat-card activities-stat-side">
          <p>Total Members</p>
          <h3>{members.length}</h3>
        </div>
      </div>

      <div className="activities-grid">
        <section className="activities-main">
          <div className="activities-breakdown-header">
            <h3>Activities Breakdown</h3>
            <div className="activities-breakdown-tabs">
              <button className="activities-tab active">Ongoing</button>
              <button className="activities-tab">Completed</button>
              <button className="activities-tab">Upcoming</button>
            </div>
          </div>

          <div className="activities-search-row">
            <div className="activities-search">
              <Icon name="search" size={16} />
              <input type="text" placeholder="Search..." />
            </div>
            <button className="activities-filter-pill" type="button">
              All Activities <Icon name="chevron" size={16} />
            </button>
          </div>

          <div className="activities-category-tabs">
            <button className="activities-category active">All</button>
            <button className="activities-category">Sales</button>
            <button className="activities-category">Expenses</button>
            <button className="activities-category">Reports</button>
          </div>

          <div className="activities-list">
            {activityItems.length > 0 ? (
              activityItems.map((item) => (
                <div
                  className="activity-row"
                  key={item.id || item.title}
                  onClick={() => {
                    setSelectedActivity(item);
                    setFormData({
                      title: item.title || "",
                      type: item.category || "General",
                      date: item.date ? item.date.split("T")[0] : new Date().toISOString().split("T")[0],
                      description: item.description || "",
                      status: item.status || "scheduled",
                      location: item.location || "",
                      agenda: item.title || "",
                      assignees: item.assignees || [],
                      attendees: item.attendees || [],
                    });
                    setActivityTab("details");
                    setShowAddActivityModal(true);
                  }}
                  style={{ cursor: "pointer" }}
                >
                  <div className="activity-main">
                    <h4>{item.title}</h4>
                    <span className="activity-meta">
                      {item.category}
                      {item.location && ` • ${item.location}`}
                      {item.attendees && item.attendees.length > 0 && ` • ${item.attendees.length} attendee${item.attendees.length !== 1 ? "s" : ""}`}
                    </span>
                  </div>
                  <div className="activity-date">{formatDate(item.date)}</div>
                  <div className="activity-amount">
                    <span className={`status-badge status-${item.status}`}>
                      {item.status?.replace(/_/g, " ").charAt(0).toUpperCase() + item.status?.slice(1).replace(/_/g, " ")}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ padding: "2rem", textAlign: "center", color: "#999" }}>
                No activities yet. Click "Add activity" to create one.
              </div>
            )}
          </div>
        </section>

        <aside className="activities-side">
          <div className="activities-card">
            <div className="activities-card-header">
              <h4>Welfare Cycles</h4>
              <button type="button">View all</button>
            </div>
            <div className="activities-card-list">
              {welfareSummary?.cycles && welfareSummary.cycles.length > 0 ? (
                <>
                  {welfareSummary.cycles.slice(0, 3).map((cycle, idx) => (
                    <div className="activities-card-item" key={idx}>
                      <span>Cycle {cycle.cycle_number}</span>
                      <span>{cycle.status || "Pending"}</span>
                    </div>
                  ))}
                  <div className="activities-card-total">
                    <span>Total Cycles</span>
                    <span>{welfareSummary.totalCycles}</span>
                  </div>
                </>
              ) : (
                <div style={{ padding: "1rem", textAlign: "center", color: "#999" }}>
                  No welfare cycles yet
                </div>
              )}
            </div>
          </div>

          <div className="activities-card">
            <div className="activities-card-header">
              <h4>Members</h4>
              <button type="button">
                {members.length > 4 ? `+${members.length - 4}` : "All"}
              </button>
            </div>
            <div className="activities-member-stack">
              {members.slice(0, 4).map((member, idx) => (
                <div className="member-avatar" key={member.id || idx}>
                  {member.name?.charAt(0).toUpperCase() || "?"}
                </div>
              ))}
              {members.length > 4 && (
                <div className="member-avatar">+{members.length - 4}</div>
              )}
            </div>
            <button className="activities-member-btn" type="button">
              Manage members
            </button>
            <div className="activities-member-summary">
              <span>{members.length} Members</span>
              <span>
                {members.filter((m) => m.role === "admin").length} Admins
              </span>
              <span>
                {members.filter((m) => m.role === "treasurer").length} Treasurers
              </span>
            </div>
          </div>
        </aside>
      </div>

      <DataModal
        open={showAddActivityModal}
        onClose={() => {
          setShowAddActivityModal(false);
          setSelectedActivity(null);
        }}
        title={selectedActivity ? "Edit activity" : "Add activity"}
        subtitle={selectedActivity ? "Update activity details and members." : "Capture activity details, value impact, and ownership."}
        icon={selectedActivity ? "edit" : "plus"}
      >
        <form className="data-modal-form" onSubmit={handleSubmitActivity}>
          <div className="data-modal-tabs">
            <button
              type="button"
              className={`data-modal-tab ${activityTab === "details" ? "active" : ""}`}
              onClick={() => setActivityTab("details")}
            >
              Details
            </button>
            <button
              type="button"
              className={`data-modal-tab ${activityTab === "finance" ? "active" : ""}`}
              onClick={() => setActivityTab("finance")}
            >
              Finance
            </button>
            <button
              type="button"
              className={`data-modal-tab ${activityTab === "assignees" ? "active" : ""}`}
              onClick={() => setActivityTab("assignees")}
            >
              Assignees
            </button>
            <button
              type="button"
              className={`data-modal-tab ${activityTab === "attendees" ? "active" : ""}`}
              onClick={() => setActivityTab("attendees")}
            >
              Attendees
            </button>
          </div>

          {activityTab === "details" ? (
            <div className="data-modal-grid">
              <label className="data-modal-field">
                Activity title
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleFormChange}
                  placeholder="e.g. School fee disbursement"
                />
              </label>
              <label className="data-modal-field">
                Category
                <select
                  name="type"
                  value={formData.type}
                  onChange={handleFormChange}
                >
                  <option value="General">General</option>
                  <option value="Sales">Sales</option>
                  <option value="Expenses">Expenses</option>
                  <option value="Welfare">Welfare</option>
                  <option value="Report">Report</option>
                </select>
              </label>
              <label className="data-modal-field">
                Activity date
                <input
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleFormChange}
                />
              </label>
              <label className="data-modal-field">
                Status
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleFormChange}
                >
                  <option value="scheduled">Scheduled</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                </select>
              </label>
              <label className="data-modal-field">
                Location
                <input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleFormChange}
                  placeholder="e.g. Community Center"
                />
              </label>
              <label className="data-modal-field data-modal-field--full">
                Description
                <textarea
                  rows="4"
                  name="description"
                  value={formData.description}
                  onChange={handleFormChange}
                  placeholder="Add a short description for this activity."
                />
              </label>
            </div>
          ) : null}

          {activityTab === "finance" ? (
            <div className="data-modal-grid">
              <label className="data-modal-field">
                Amount (KES)
                <input type="number" placeholder="5000" />
              </label>
              <label className="data-modal-field">
                Value type
                <select defaultValue="income">
                  <option value="income">Income</option>
                  <option value="expense">Expense</option>
                </select>
              </label>
              <label className="data-modal-field">
                Budget line
                <select defaultValue="general">
                  <option value="general">General</option>
                  <option value="operations">Operations</option>
                  <option value="welfare">Welfare</option>
                  <option value="projects">Projects</option>
                </select>
              </label>
              <label className="data-modal-field">
                Reference
                <input type="text" placeholder="Receipt or transaction code" />
              </label>
              <label className="data-modal-field data-modal-field--full">
                Financial note
                <textarea rows="4" placeholder="Optional note for finance records." />
              </label>
            </div>
          ) : null}

          {activityTab === "assignees" ? (
            <div className="data-modal-grid">
              <div className="data-modal-field data-modal-field--full">
                <label>Select Members (Responsible)</label>
                <div className="member-selection-grid">
                  {members && members.length > 0 ? (
                    members.map((member) => (
                      <label key={member.id} className="member-checkbox">
                        <input
                          type="checkbox"
                          checked={(formData.assignees || []).includes(member.id)}
                          onChange={() => handleToggleAssignee(member.id)}
                        />
                        <span className="member-checkbox-label">
                          <span className="member-avatar-small">
                            {member.name?.charAt(0).toUpperCase() || "?"}
                          </span>
                          <span className="member-info">
                            <span className="member-name">{member.name}</span>
                            <span className="member-role">{member.role}</span>
                          </span>
                        </span>
                      </label>
                    ))
                  ) : (
                    <p style={{ color: "#999", padding: "1rem" }}>No members available</p>
                  )}
                </div>
              </div>
              <div className="data-modal-field data-modal-field--full">
                <p style={{ fontSize: "0.875rem", color: "#666", marginTop: "0.5rem" }}>
                  Selected: {(formData.assignees || []).length} assignee{(formData.assignees || []).length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
          ) : null}

          {activityTab === "attendees" ? (
            <div className="data-modal-grid">
              {/* Members as Attendees */}
              <div className="data-modal-field data-modal-field--full">
                <label>Members Attending</label>
                <div className="member-selection-grid">
                  {members && members.length > 0 ? (
                    members.map((member) => (
                      <label key={`member-${member.id}`} className="member-checkbox">
                        <input
                          type="checkbox"
                          checked={(formData.attendees || []).includes(`member:${member.id}`)}
                          onChange={() => handleToggleAttendee(member.id, "member")}
                        />
                        <span className="member-checkbox-label">
                          <span className="member-avatar-small">
                            {member.name?.charAt(0).toUpperCase() || "?"}
                          </span>
                          <span className="member-info">
                            <span className="member-name">{member.name}</span>
                            <span className="member-role">{member.role}</span>
                          </span>
                        </span>
                      </label>
                    ))
                  ) : (
                    <p style={{ color: "#999", padding: "1rem" }}>No members available</p>
                  )}
                </div>
              </div>

              {/* Event Subscribers */}
              {eventSubscribers && eventSubscribers.length > 0 && (
                <div className="data-modal-field data-modal-field--full">
                  <label>Event Subscribers</label>
                  <div className="member-selection-grid">
                    {eventSubscribers.map((subscriber) => (
                      <label key={`subscriber-${subscriber.id}`} className="member-checkbox">
                        <input
                          type="checkbox"
                          checked={(formData.attendees || []).includes(`subscriber:${subscriber.id}`)}
                          onChange={() => handleToggleAttendee(subscriber.id, "subscriber")}
                        />
                        <span className="member-checkbox-label">
                          <span className="member-avatar-small">
                            {subscriber.name?.charAt(0).toUpperCase() || "?"}
                          </span>
                          <span className="member-info">
                            <span className="member-name">{subscriber.name}</span>
                            <span className="member-role">{subscriber.email}</span>
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Add New Attendee Button */}
              <div className="data-modal-field data-modal-field--full">
                {!showNewSubscriberForm ? (
                  <button
                    type="button"
                    className="data-modal-btn"
                    onClick={() => setShowNewSubscriberForm(true)}
                    style={{ marginTop: "1rem", width: "100%" }}
                  >
                    + Add New Attendee
                  </button>
                ) : (
                  <div style={{ border: "1px solid #e0e0e0", borderRadius: "8px", padding: "1rem", marginTop: "1rem" }}>
                    <h4 style={{ marginBottom: "1rem" }}>Add New Attendee</h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                      <input
                        type="text"
                        value={newSubscriber.name}
                        onChange={(e) => setNewSubscriber({ ...newSubscriber, name: e.target.value })}
                        placeholder="Full name"
                        style={{
                          padding: "0.75rem",
                          border: "1px solid #ddd",
                          borderRadius: "4px",
                          fontSize: "0.875rem",
                        }}
                      />
                      <input
                        type="email"
                        value={newSubscriber.email}
                        onChange={(e) => setNewSubscriber({ ...newSubscriber, email: e.target.value })}
                        placeholder="Email address"
                        style={{
                          padding: "0.75rem",
                          border: "1px solid #ddd",
                          borderRadius: "4px",
                          fontSize: "0.875rem",
                        }}
                      />
                      <input
                        type="text"
                        value={newSubscriber.contact}
                        onChange={(e) => setNewSubscriber({ ...newSubscriber, contact: e.target.value })}
                        placeholder="Phone number (optional)"
                        style={{
                          padding: "0.75rem",
                          border: "1px solid #ddd",
                          borderRadius: "4px",
                          fontSize: "0.875rem",
                        }}
                      />
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
                      <button
                        type="button"
                        className="data-modal-btn"
                        onClick={() => {
                          setShowNewSubscriberForm(false);
                          setNewSubscriber({ name: "", email: "", contact: "" });
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="data-modal-btn data-modal-btn--primary"
                        onClick={handleAddNewSubscriber}
                      >
                        Add Attendee
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="data-modal-field data-modal-field--full">
                <p style={{ fontSize: "0.875rem", color: "#666", marginTop: "0.5rem" }}>
                  Total attendees: {(formData.attendees || []).length}
                </p>
              </div>
            </div>
          ) : null}

          <div className="data-modal-actions">
            <button
              type="button"
              className="data-modal-btn"
              onClick={() => setShowAddActivityModal(false)}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="data-modal-btn data-modal-btn--primary"
              disabled={submitting}
            >
              {submitting ? "Saving..." : "Save activity"}
            </button>
          </div>
        </form>
      </DataModal>
    </div>
  );
}
