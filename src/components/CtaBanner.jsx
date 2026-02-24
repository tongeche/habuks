import { useNewsletter } from "../hooks/useNewsletter.js";

export default function CtaBanner({ data }) {
  const banner = data?.ctaBanner ?? {};
  const cta = banner.cta ?? {};
  const backgroundImage = banner.backgroundImage ?? "";
  const variant = banner.variant ?? "cta";
  const form = banner.form ?? {};
  const inputPlaceholder = form.inputPlaceholder ?? "Enter email";
  const buttonLabel = form.buttonLabel ?? "Sign up";
  const formNote = form.note ?? "";

  // Use newsletter hook for form handling
  const {
    email,
    setEmail,
    subscribe,
    isLoading,
    isSuccess,
    isError,
    message,
  } = useNewsletter("landing");

  if (variant === "newsletter") {
    return (
      <section
        className="cta-banner newsletter"
        id={banner.id ?? "newsletter"}
        data-animate="fade-up"
      >
        <div className="container cta-banner-inner newsletter-inner">
          <div className="cta-banner-content">
            {banner.kicker ? <p className="cta-kicker">{banner.kicker}</p> : null}
            {banner.title ? <h2>{banner.title}</h2> : null}
            {banner.description ? <p className="cta-description">{banner.description}</p> : null}
          </div>

          {!isSuccess ? (
            <>
              <form className="cta-signup" onSubmit={subscribe}>
                <input
                  type="email"
                  placeholder={inputPlaceholder}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  required
                />
                <button type="submit" disabled={isLoading}>
                  {isLoading ? (
                    <span className="cta-spinner" />
                  ) : (
                    buttonLabel
                  )}
                </button>
              </form>
              {isError && message ? (
                <p className="cta-note cta-note--error">{message}</p>
              ) : formNote ? (
                <p className="cta-note">
                  {typeof formNote === "string" ? (
                    formNote
                  ) : (
                    <>
                      {formNote.prefix ? `${formNote.prefix} ` : null}
                      {formNote.linkLabel ? (
                        <a href={formNote.linkHref ?? "#"}>{formNote.linkLabel}</a>
                      ) : null}
                      {formNote.suffix ? ` ${formNote.suffix}` : null}
                    </>
                  )}
                </p>
              ) : null}
            </>
          ) : (
            <div className="cta-success">
              <svg className="cta-success-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <span>{message}</span>
            </div>
          )}
        </div>
      </section>
    );
  }

  return (
    <section
      className="cta-banner"
      id={banner.id ?? "volunteer-cta"}
      data-animate="fade-up"
      style={{ "--banner-image": backgroundImage ? `url('${backgroundImage}')` : "none" }}
    >
      <div className="container cta-banner-inner">
        <div className="cta-banner-content">
          {banner.kicker ? <p className="cta-kicker">{banner.kicker}</p> : null}
          {banner.title ? <h2>{banner.title}</h2> : null}
          {banner.description ? <p className="cta-description">{banner.description}</p> : null}
        </div>
        {cta.label ? (
          <a className="btn btn-light" href={cta.href ?? "#"}>
            {cta.label}
          </a>
        ) : null}
      </div>
    </section>
  );
}
