import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../icons.jsx";
import { signOut } from "../../lib/dataService.js";

export default function UserDropdown({ user, onOpenInviteModal, onOpenProfileSettings }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const handleLogout = async () => {
    try {
      await signOut();
      navigate("/login");
    } catch (error) {
      console.error("Error signing out:", error);
      navigate("/login");
    }
  };

  const handleInviteClick = () => {
    setIsOpen(false);
    onOpenInviteModal?.();
  };

  const handleProfileClick = () => {
    setIsOpen(false);
    onOpenProfileSettings?.();
  };

  return (
    <div className="user-dropdown" ref={dropdownRef}>
      <button
        className="user-dropdown-trigger"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="User menu"
        aria-expanded={isOpen}
      >
        <div className="dashboard-avatar">
          {user?.name ? user.name.charAt(0).toUpperCase() : "M"}
        </div>
      </button>

      {isOpen && (
        <div className="user-dropdown-menu">
          <div className="user-dropdown-header">
            <div className="user-dropdown-avatar">
              {user?.name ? user.name.charAt(0).toUpperCase() : "M"}
            </div>
            <div className="user-dropdown-info">
              <p className="user-dropdown-name">{user?.name || "Member"}</p>
              <p className="user-dropdown-email">{user?.email || ""}</p>
            </div>
          </div>

          <div className="user-dropdown-divider" />

          <button
            className="user-dropdown-item"
            onClick={handleInviteClick}
          >
            <Icon name="mail" size={16} />
            <span>Invite Member</span>
          </button>

          <button
            className="user-dropdown-item"
            onClick={handleProfileClick}
          >
            <Icon name="user" size={16} />
            <span>Profile Settings</span>
          </button>

          <div className="user-dropdown-divider" />

          <button
            className="user-dropdown-item user-dropdown-item--danger"
            onClick={handleLogout}
          >
            <Icon name="logout" size={16} />
            <span>Logout</span>
          </button>
        </div>
      )}
    </div>
  );
}

