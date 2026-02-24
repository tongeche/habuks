import { Icon } from "../icons.jsx";

export default function ChoiceModal({
  open,
  onClose,
  title,
  message,
  option1Label = "Option 1",
  option1Icon = "check",
  option1Description = "",
  onOption1Click,
  option2Label = "Option 2",
  option2Icon = "info",
  option2Description = "",
  onOption2Click,
}) {
  if (!open) return null;

  return (
    <div className="choice-modal-overlay" onClick={onClose} role="presentation">
      <div
        className="choice-modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="choice-modal-close"
          type="button"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>

        <div className="choice-modal-content">
          {title && <h2 className="choice-modal-title">{title}</h2>}
          {message && <p className="choice-modal-message">{message}</p>}

          <div className="choice-modal-options">
            <button
              type="button"
              className="choice-modal-option"
              onClick={() => {
                onOption1Click?.();
                onClose();
              }}
            >
              <div className="choice-modal-option-icon">
                <Icon name={option1Icon} size={24} />
              </div>
              <div className="choice-modal-option-content">
                <h3>{option1Label}</h3>
                {option1Description && <p>{option1Description}</p>}
              </div>
              <Icon name="arrow-right" size={20} className="choice-modal-option-arrow" />
            </button>

            <button
              type="button"
              className="choice-modal-option"
              onClick={() => {
                onOption2Click?.();
                onClose();
              }}
            >
              <div className="choice-modal-option-icon">
                <Icon name={option2Icon} size={24} />
              </div>
              <div className="choice-modal-option-content">
                <h3>{option2Label}</h3>
                {option2Description && <p>{option2Description}</p>}
              </div>
              <Icon name="arrow-right" size={20} className="choice-modal-option-arrow" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

