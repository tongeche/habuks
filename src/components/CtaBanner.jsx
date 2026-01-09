export default function CtaBanner({ data }) {
  const banner = data?.ctaBanner ?? {};
  const cta = banner.cta ?? {};
  const backgroundImage = banner.backgroundImage ?? "";

  return (
    <section
      className="cta-banner"
      id={banner.id ?? "volunteer-cta"}
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
