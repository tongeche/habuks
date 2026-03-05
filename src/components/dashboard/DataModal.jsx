import { useEffect } from "react";
import { Icon } from "../icons.jsx";

export default function DataModal({
  open,
  onClose,
  title,
  subtitle,
  icon = "folder",
  className = "",
  bodyClassName = "",
  hideHeader = false,
  children,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKey = (event) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", handleKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="data-modal-overlay" onClick={onClose} role="presentation">
      <div
        className={`data-modal ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={!hideHeader ? "data-modal-title" : undefined}
        aria-describedby={!hideHeader && subtitle ? "data-modal-subtitle" : undefined}
        aria-label={hideHeader ? title : undefined}
        onClick={(event) => event.stopPropagation()}
      >
        {!hideHeader ? (
          <div className="data-modal-header">
            <div className="data-modal-heading">
              <span className="data-modal-icon">
                <Icon name={icon} size={18} />
              </span>
              <div>
                <h2 id="data-modal-title">{title}</h2>
                {subtitle ? <p id="data-modal-subtitle">{subtitle}</p> : null}
              </div>
            </div>
            <button className="data-modal-close" type="button" onClick={onClose} aria-label="Close">
              ×
            </button>
          </div>
        ) : null}
        <div className={`data-modal-body ${bodyClassName}`.trim()}>{children}</div>
      </div>
    </div>
  );
}
