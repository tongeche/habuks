export default function PricingSection({ data }) {
  const section = data?.pricingSection ?? {};
  const plans = Array.isArray(section.plans) ? section.plans : [];
  const id = section.id ?? "pricing";
  const slugify = (value) =>
    String(value ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "");

  if (!section.title && !section.description && !plans.length) {
    return null;
  }

  return (
    <section className="pricing" id={id} data-animate="fade-up">
      <div className="container">
        <div className="pricing-header">
          {section.kicker ? (
            <div className="pricing-pill-row">
              <p className="pricing-kicker">{section.kicker}</p>
            </div>
          ) : null}
          {section.title ? <h2>{section.title}</h2> : null}
          {section.description ? <p>{section.description}</p> : null}
        </div>

        <div className="pricing-grid">
          {plans.map((plan, index) => {
            const planKey = slugify(plan.name);
            return (
              <article
                className={`pricing-card pricing-card--${planKey}${
                  plan.highlight ? " is-highlight" : ""
                }`}
                key={`${plan.name}-${index}`}
              >
              <div className="pricing-card-top">
                {plan.badge ? <span className="pricing-badge">{plan.badge}</span> : null}
                {plan.name ? <h3>{plan.name}</h3> : null}
                {plan.summary ? <p className="pricing-summary">{plan.summary}</p> : null}
                <div className="pricing-price">
                  <span className="pricing-amount">{plan.price ?? "Talk to sales"}</span>
                  {plan.priceNote ? <span className="pricing-note">{plan.priceNote}</span> : null}
                </div>
                {plan.cta?.label ? (
                  <a className="pricing-cta" href={plan.cta.href ?? "#"}>
                    {plan.cta.label}
                  </a>
                ) : null}
              </div>
              {plan.features?.length ? (
                <ul className="pricing-features">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={`${feature}-${featureIndex}`}>{feature}</li>
                  ))}
                </ul>
              ) : null}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
