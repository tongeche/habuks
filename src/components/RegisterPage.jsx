export default function RegisterPage() {
  return (
    <div className="auth-page register-page">
      <div className="auth-form-col">
        <div className="auth-form-inner register-form-inner">
          <a href="/" className="auth-logo">
            <img src="/assets/logo.png" alt="Jongol Foundation" />
          </a>
          <h1>Need access?</h1>
          <p className="auth-note">
            Contact us to request access and we will assist you.
          </p>
          <div className="register-actions">
            <a href="/#contact" className="auth-btn">Contact Us</a>
            <a href="/login" className="auth-btn-secondary">Go to Login</a>
          </div>
          <a href="/" className="auth-back">Back to Home</a>
        </div>
      </div>
      <div className="auth-illustration-col register-illustration-col">
        <div className="auth-illustration register-illustration">
          <svg viewBox="0 0 300 220" fill="none" xmlns="http://www.w3.org/2000/svg">
            <ellipse cx="150" cy="200" rx="130" ry="15" fill="#e6f7f2"/>
            <circle cx="150" cy="100" r="25" fill="#2d7a46"/>
            <circle cx="150" cy="75" r="18" fill="#398426"/>
            <rect x="135" y="125" width="30" height="50" rx="4" fill="#2d7a46"/>
            <circle cx="80" cy="110" r="20" fill="#6ca71f"/>
            <circle cx="80" cy="90" r="14" fill="#398426"/>
            <rect x="68" y="130" width="24" height="40" rx="4" fill="#6ca71f"/>
            <circle cx="220" cy="110" r="20" fill="#6ca71f"/>
            <circle cx="220" cy="90" r="14" fill="#398426"/>
            <rect x="208" y="130" width="24" height="40" rx="4" fill="#6ca71f"/>
            <path d="M100 115 L130 105" stroke="#b6ead1" strokeWidth="2" strokeDasharray="4 2"/>
            <path d="M200 115 L170 105" stroke="#b6ead1" strokeWidth="2" strokeDasharray="4 2"/>
            <circle cx="50" cy="60" r="6" fill="#b6ead1"/>
            <circle cx="250" cy="50" r="8" fill="#b6ead1"/>
            <circle cx="280" cy="120" r="5" fill="#2d7a46"/>
            <circle cx="20" cy="140" r="4" fill="#2d7a46"/>
            <circle cx="120" cy="40" r="4" fill="#6ca71f"/>
            <circle cx="180" cy="35" r="3" fill="#6ca71f"/>
          </svg>
        </div>
      </div>
    </div>
  );
}
