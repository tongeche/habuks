/**
 * NewsletterCard Component
 * A reusable newsletter subscription card that can be used anywhere
 */

import { useNewsletter } from "../hooks/useNewsletter.js";
import "./NewsletterCard.css";

export default function NewsletterCard({
  title = "Subscribe to our newsletter",
  subtitle = "Get the latest updates delivered to your inbox.",
  placeholder = "Enter your email",
  buttonText = "Subscribe",
  disclaimer = "No spam. Unsubscribe anytime.",
  source = "website",
  variant = "default", // default | compact | inline
  className = "",
}) {
  const {
    email,
    setEmail,
    status,
    message,
    subscribe,
    isLoading,
    isSuccess,
  } = useNewsletter(source);

  return (
    <div className={`newsletter-card newsletter-card--${variant} ${className}`}>
      {!isSuccess ? (
        <>
          <div className="newsletter-card__content">
            <h3 className="newsletter-card__title">{title}</h3>
            <p className="newsletter-card__subtitle">{subtitle}</p>
          </div>

          <form className="newsletter-card__form" onSubmit={subscribe}>
            <div className="newsletter-card__input-wrap">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={placeholder}
                className="newsletter-card__input"
                disabled={isLoading}
                required
                aria-label="Email address"
              />
              <button
                type="submit"
                className="newsletter-card__btn"
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="newsletter-card__spinner" />
                ) : (
                  buttonText
                )}
              </button>
            </div>

            {status === "error" && message && (
              <p className="newsletter-card__message newsletter-card__message--error">
                {message}
              </p>
            )}

            {disclaimer && (
              <p className="newsletter-card__disclaimer">{disclaimer}</p>
            )}
          </form>
        </>
      ) : (
        <div className="newsletter-card__success">
          <div className="newsletter-card__success-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <h3 className="newsletter-card__success-title">You're subscribed!</h3>
          <p className="newsletter-card__success-message">{message}</p>
        </div>
      )}
    </div>
  );
}
