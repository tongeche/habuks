import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../icons.jsx";
import ProjectEditorForm from "../dashboard/ProjectEditorForm.jsx";
import useInViewPlayback from "./hooks/useInViewPlayback.js";
import useTimeline from "./hooks/useTimeline.js";

const NEW_PROJECT_DEMO_STEPS = [
  { name: "reset", ms: 320 },
  { name: "focus-name", ms: 420 },
  { name: "type-name", ms: 1200 },
  { name: "focus-start-date", ms: 360 },
  { name: "type-start-date", ms: 620 },
  { name: "focus-summary", ms: 360 },
  { name: "type-summary", ms: 1300 },
  { name: "focus-submit", ms: 380 },
  { name: "submit", ms: 540 },
  { name: "show-success", ms: 900 },
];

const DEMO_VALUES = {
  name: "Community Poultry Project",
  startDate: "2026-03-15",
  summary: "Scale poultry output with member-led scheduling, feed tracking, and market-ready reporting.",
};

const joinClassNames = (...classes) => classes.filter(Boolean).join(" ");

const createDemoForm = () => ({
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

export default function NewProjectFormDemo({
  className = "",
  mode = "pause-offscreen",
  blend = false,
}) {
  const { ref: containerRef, shouldPlay } = useInViewPlayback({ threshold: 0.4, mode });
  const typingRef = useRef({ intervalId: null, timeoutId: null });
  const [activeTab, setActiveTab] = useState("info");
  const [form, setForm] = useState(() => createDemoForm());
  const [focusedField, setFocusedField] = useState("");
  const [submitPulse, setSubmitPulse] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleChange = () => setPrefersReducedMotion(media.matches);

    handleChange();
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, []);

  const clearTypingAnimation = useCallback(() => {
    const { intervalId, timeoutId } = typingRef.current;
    if (intervalId) {
      clearInterval(intervalId);
    }
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    typingRef.current = { intervalId: null, timeoutId: null };
  }, []);

  const updateField = useCallback((field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const focusField = useCallback(
    (field) => {
      setFocusedField(field);
      const element = containerRef.current?.querySelector(`[data-demo-field="${field}"]`);
      if (element && typeof element.focus === "function") {
        element.focus({ preventScroll: true });
      }
    },
    [containerRef]
  );

  const resetDemo = useCallback(() => {
    clearTypingAnimation();
    setActiveTab("info");
    setFocusedField("");
    setSubmitPulse(false);
    setShowSuccess(false);
    setForm(createDemoForm());
  }, [clearTypingAnimation]);

  const typeFieldValue = useCallback(
    (field, text, durationMs) => {
      clearTypingAnimation();
      updateField(field, "");

      const characters = String(text || "");
      const steps = Math.max(1, characters.length);
      const cadence = Math.max(24, Math.floor(durationMs / steps));

      let cursor = 0;
      typingRef.current.intervalId = setInterval(() => {
        cursor += 1;
        updateField(field, characters.slice(0, cursor));
        if (cursor >= characters.length) {
          clearTypingAnimation();
        }
      }, cadence);

      typingRef.current.timeoutId = setTimeout(() => {
        updateField(field, characters);
        clearTypingAnimation();
      }, durationMs + 24);
    },
    [clearTypingAnimation, updateField]
  );

  useEffect(() => {
    return () => {
      clearTypingAnimation();
    };
  }, [clearTypingAnimation]);

  useEffect(() => {
    if (shouldPlay || prefersReducedMotion) {
      return;
    }
    clearTypingAnimation();
    setFocusedField("");
    setSubmitPulse(false);
  }, [shouldPlay, prefersReducedMotion, clearTypingAnimation]);

  useEffect(() => {
    if (!prefersReducedMotion) {
      return;
    }

    clearTypingAnimation();
    setActiveTab("info");
    setFocusedField("");
    setSubmitPulse(false);
    setShowSuccess(true);
    setForm((prev) => ({
      ...prev,
      name: DEMO_VALUES.name,
      startDate: DEMO_VALUES.startDate,
      summary: DEMO_VALUES.summary,
    }));
  }, [prefersReducedMotion, clearTypingAnimation]);

  const handleTimelineStep = useCallback(
    (step) => {
      if (!step?.name) return;

      switch (step.name) {
        case "reset":
          resetDemo();
          break;
        case "focus-name":
          focusField("name");
          break;
        case "type-name":
          focusField("name");
          typeFieldValue("name", DEMO_VALUES.name, step.ms);
          break;
        case "focus-start-date":
          focusField("startDate");
          break;
        case "type-start-date":
          focusField("startDate");
          typeFieldValue("startDate", DEMO_VALUES.startDate, step.ms);
          break;
        case "focus-summary":
          focusField("summary");
          break;
        case "type-summary":
          focusField("summary");
          typeFieldValue("summary", DEMO_VALUES.summary, step.ms);
          break;
        case "focus-submit":
          focusField("submit");
          break;
        case "submit":
          focusField("submit");
          setSubmitPulse(true);
          break;
        case "show-success":
          setFocusedField("");
          setSubmitPulse(false);
          setShowSuccess(true);
          break;
        default:
          break;
      }
    },
    [focusField, resetDemo, typeFieldValue]
  );

  useTimeline({
    steps: NEW_PROJECT_DEMO_STEPS,
    isActive: shouldPlay && !prefersReducedMotion,
    loop: true,
    resetOnStop: false,
    onStep: handleTimelineStep,
  });

  const fieldClassNames = useMemo(
    () => ({
      name: focusedField === "name" ? "project-demo-field-active" : "",
      moduleKey: focusedField === "moduleKey" ? "project-demo-field-active" : "",
      startDate: focusedField === "startDate" ? "project-demo-field-active" : "",
      status: focusedField === "status" ? "project-demo-field-active" : "",
      summary: focusedField === "summary" ? "project-demo-field-active" : "",
      submit: joinClassNames(
        focusedField === "submit" ? "project-demo-field-active" : "",
        submitPulse ? "project-demo-submit-pulse" : ""
      ),
    }),
    [focusedField, submitPulse]
  );

  const handleFieldChange = useCallback(
    (field, value) => {
      updateField(field, value);
      setShowSuccess(false);
      if (focusedField !== field) {
        setFocusedField(field);
      }
    },
    [focusedField, updateField]
  );

  return (
    <div ref={containerRef} className={joinClassNames("project-demo-shell", className)}>
      <article
        className={joinClassNames(
          blend ? "" : "data-modal",
          "project-demo-modal",
          blend ? "project-demo-modal--blend" : ""
        )}
        aria-label="New project form demo"
      >
        <div className="data-modal-header">
          <div className="data-modal-heading">
            <span className="data-modal-icon">
              <Icon name="briefcase" size={18} />
            </span>
            <div>
              <h2>New Project</h2>
              <p>Add a new income-generating activity for your group.</p>
            </div>
          </div>
          <button
            className="data-modal-close"
            type="button"
            onClick={resetDemo}
            aria-label="Reset demo"
          >
            {"\u00D7"}
          </button>
        </div>

        <div className="data-modal-body">
          <ProjectEditorForm
            activeTab={activeTab}
            onTabChange={setActiveTab}
            form={form}
            onFieldChange={handleFieldChange}
            onSubmit={(event) => event.preventDefault()}
            onCancel={resetDemo}
            createProjectError=""
            creatingProject={false}
            isEditingProject={false}
            membersLoading={false}
            memberDirectory={[]}
            primaryContact={null}
            selectedMemberOptions={[]}
            selectedAdditionalMembers={[]}
            selectedExistingMedia={[]}
            selectedMediaFiles={[]}
            mediaFolderPreview="tenants/demo/projects/{projectId}/media"
            fieldClassNames={fieldClassNames}
          />
        </div>

        <div
          className={joinClassNames("project-demo-success", showSuccess ? "is-visible" : "")}
          role="status"
          aria-live="polite"
        >
          Project created successfully.
        </div>
      </article>
    </div>
  );
}
