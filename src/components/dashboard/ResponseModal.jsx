import { Icon } from "../icons.jsx";

export default function ResponseModal({
  open,
  onClose,
  type = "success", // success, error, info, warning
  title,
  message,
  code, // For displaying invite numbers, codes, etc.
  codeLabel = "Code",
  onCopyCode,
  actions = [], // Array of { label, onClick, variant: 'primary' | 'secondary' }
}) {
  if (!open) return null;

  const typeConfig = {
    success: {
      icon: "check-circle",
      bgColor: "#f0fdf4",
      borderColor: "#bbf7d0",
      textColor: "#059669",
      iconBg: "#dcfce7",
    },
    error: {
      icon: "alert-circle",
      bgColor: "#fef2f2",
      borderColor: "#fecaca",
      textColor: "#dc2626",
      iconBg: "#fee2e2",
    },
    info: {
      icon: "info",
      bgColor: "#eff6ff",
      borderColor: "#bfdbfe",
      textColor: "#2563eb",
      iconBg: "#dbeafe",
    },
    warning: {
      icon: "alert-triangle",
      bgColor: "#fffbeb",
      borderColor: "#fde68a",
      textColor: "#b45309",
      iconBg: "#fef3c7",
    },
  };

  const config = typeConfig[type] || typeConfig.success;

  return (
    <div className="response-modal-overlay" onClick={onClose} role="presentation">
      <div
        className="response-modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="response-modal-close"
          type="button"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>

        <div className="response-modal-content">
          <div className="response-modal-icon" style={{ background: config.iconBg }}>
            <Icon name={config.icon} size={32} color={config.textColor} />
          </div>

          {title && <h2 className="response-modal-title">{title}</h2>}

          {message && <p className="response-modal-message">{message}</p>}

          {code && (
            <div className="response-modal-code-box">
              <div className="response-modal-code-label">{codeLabel}</div>
              <div className="response-modal-code-display">
                <code>{code}</code>
                <button
                  type="button"
                  className="response-modal-copy-btn"
                  onClick={onCopyCode || (() => navigator.clipboard.writeText(code))}
                  title="Copy to clipboard"
                >
                  <Icon name="copy" size={16} />
                </button>
              </div>
            </div>
          )}

          {actions.length > 0 && (
            <div className="response-modal-actions">
              {actions.map((action, idx) => (
                <button
                  key={idx}
                  type="button"
                  className={`response-modal-btn response-modal-btn--${action.variant || "secondary"}`}
                  onClick={action.onClick}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

