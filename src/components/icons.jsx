export const Icon = ({ name, size = 18, className = "" }) => {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className
  };

  switch (name) {
    case "mail":
      return (
        <svg {...common} aria-hidden="true">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M3 7l9 6 9-6" />
        </svg>
      );
    case "facebook":
      return (
        <svg {...common} aria-hidden="true">
          <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
        </svg>
      );
    case "x":
      return (
        <svg {...common} aria-hidden="true">
          <path d="M4 4l16 16" />
          <path d="M20 4L4 20" />
        </svg>
      );
    case "instagram":
      return (
        <svg {...common} aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17" cy="7" r="1" />
        </svg>
      );
    case "linkedin":
      return (
        <svg {...common} aria-hidden="true">
          <rect x="3" y="9" width="4" height="12" />
          <circle cx="5" cy="5" r="2" />
          <path d="M13 10v11" />
          <path d="M13 15a4 4 0 0 1 8 0v6" />
        </svg>
      );
    case "youtube":
      return (
        <svg {...common} aria-hidden="true">
          <rect x="3" y="7" width="18" height="10" rx="3" />
          <path d="M11 10l4 2-4 2z" />
        </svg>
      );
    case "chevron":
      return (
        <svg {...common} aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      );
    case "menu":
      return (
        <svg {...common} aria-hidden="true">
          <path d="M3 6h18" />
          <path d="M3 12h18" />
          <path d="M3 18h18" />
        </svg>
      );
    case "volunteer":
      return (
        <svg {...common} aria-hidden="true">
          <path d="M12 21s-6.5-4.3-6.5-9.4a3.9 3.9 0 0 1 6.5-2.8a3.9 3.9 0 0 1 6.5 2.8c0 5.1-6.5 9.4-6.5 9.4z" />
        </svg>
      );
    case "member":
      return (
        <svg {...common} aria-hidden="true">
          <circle cx="12" cy="8" r="3.5" />
          <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
        </svg>
      );
    case "mission":
      return (
        <svg {...common} aria-hidden="true">
          <path d="M12 3l4 6-4 12-4-12z" />
          <path d="M6 21h12" />
        </svg>
      );
    case "vision":
      return (
        <svg {...common} aria-hidden="true">
          <circle cx="12" cy="12" r="3.2" />
          <path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6z" />
        </svg>
      );
    case "values":
      return (
        <svg {...common} aria-hidden="true">
          <circle cx="12" cy="8" r="3" />
          <path d="M6 21v-2a6 6 0 0 1 12 0v2" />
          <path d="M4 11h4" />
          <path d="M16 11h4" />
        </svg>
      );
    case "history":
      return (
        <svg {...common} aria-hidden="true">
          <circle cx="12" cy="12" r="7" />
          <path d="M12 8v4l3 2" />
        </svg>
      );
    case "home":
      return (
        <svg {...common} aria-hidden="true">
          <path d="M3 12l9-9 9 9" />
          <path d="M5 10v10a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V10" />
        </svg>
      );
    case "wallet":
      return (
        <svg {...common} aria-hidden="true">
          <rect x="2" y="6" width="20" height="14" rx="2" />
          <path d="M16 14h2" />
          <path d="M2 10h20" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...common} aria-hidden="true">
          <rect x="3" y="4" width="18" height="17" rx="2" />
          <path d="M16 2v4" />
          <path d="M8 2v4" />
          <path d="M3 10h18" />
        </svg>
      );
    case "heart":
      return (
        <svg {...common} aria-hidden="true">
          <path d="M12 21s-6.5-4.3-6.5-9.4a3.9 3.9 0 0 1 6.5-2.8 3.9 3.9 0 0 1 6.5 2.8c0 5.1-6.5 9.4-6.5 9.4z" />
        </svg>
      );
    case "briefcase":
      return (
        <svg {...common} aria-hidden="true">
          <rect x="2" y="7" width="20" height="13" rx="2" />
          <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" />
        </svg>
      );
    case "newspaper":
      return (
        <svg {...common} aria-hidden="true">
          <rect x="3" y="4" width="18" height="17" rx="2" />
          <path d="M7 8h5" />
          <path d="M7 12h10" />
          <path d="M7 16h10" />
        </svg>
      );
    case "folder":
      return (
        <svg {...common} aria-hidden="true">
          <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
        </svg>
      );
    case "users":
      return (
        <svg {...common} aria-hidden="true">
          <circle cx="9" cy="7" r="3" />
          <path d="M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2" />
          <circle cx="17" cy="7" r="2" />
          <path d="M21 21v-1a3 3 0 00-2-2.8" />
        </svg>
      );
    case "user":
      return (
        <svg {...common} aria-hidden="true">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21v-2a6 6 0 0112 0v2" />
        </svg>
      );
    case "logout":
      return (
        <svg {...common} aria-hidden="true">
          <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      );
    case "search":
      return (
        <svg {...common} aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <line x1="20" y1="20" x2="16.5" y2="16.5" />
        </svg>
      );
    case "arrow-left":
      return (
        <svg {...common} aria-hidden="true">
          <path d="M15 6l-6 6 6 6" />
        </svg>
      );
    case "arrow-right":
      return (
        <svg {...common} aria-hidden="true">
          <path d="M9 6l6 6-6 6" />
        </svg>
      );
    case "check":
      return (
        <svg {...common} aria-hidden="true">
          <path d="M5 12l5 5L20 7" />
        </svg>
      );
    case "clock":
      return (
        <svg {...common} aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 6v6l4 2" />
        </svg>
      );
    case "location":
      return (
        <svg {...common} aria-hidden="true">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
          <circle cx="12" cy="9" r="2.5" />
        </svg>
      );
    case "target":
      return (
        <svg {...common} aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="5" />
          <circle cx="12" cy="12" r="1" />
        </svg>
      );
    case "alert":
      return (
        <svg {...common} aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12" y2="16" />
        </svg>
      );
    case "coins":
      return (
        <svg {...common} aria-hidden="true">
          <circle cx="8" cy="8" r="5" />
          <path d="M13.5 10.5a5 5 0 107 7" />
          <circle cx="16" cy="16" r="5" />
        </svg>
      );
    case "trending-up":
      return (
        <svg {...common} aria-hidden="true">
          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
          <polyline points="17 6 23 6 23 12" />
        </svg>
      );
    case "receipt":
      return (
        <svg {...common} aria-hidden="true">
          <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1z" />
          <path d="M8 7h8" />
          <path d="M8 11h8" />
          <path d="M8 15h4" />
        </svg>
      );
    case "check-circle":
      return (
        <svg {...common} aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      );
    case "clock-alert":
      return (
        <svg {...common} aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 6v6l3 3" />
          <circle cx="12" cy="12" r="1" fill="currentColor" />
        </svg>
      );
    case "plus":
      return (
        <svg {...common} aria-hidden="true">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      );
    case "more-horizontal":
      return (
        <svg {...common} aria-hidden="true">
          <circle cx="12" cy="12" r="1" fill="currentColor" />
          <circle cx="19" cy="12" r="1" fill="currentColor" />
          <circle cx="5" cy="12" r="1" fill="currentColor" />
        </svg>
      );
    default:
      return null;
  }
};
