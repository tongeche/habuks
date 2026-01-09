import { useRef } from "react";
import { Icon } from "./icons.jsx";

export default function UpdatesCarousel({ data }) {
  const section = data?.updatesSection ?? {};
  const items = Array.isArray(section.items) ? section.items : [];
  const trackRef = useRef(null);

  if (!items.length && !section.title && !section.kicker) {
    return null;
  }

  const handleScroll = (direction) => {
    const track = trackRef.current;
    if (!track) {
      return;
    }

    const card = track.querySelector(".update-card");
    const cardWidth = card ? card.getBoundingClientRect().width : 280;
    const gap = 24;
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    track.scrollBy({
      left: direction * (cardWidth + gap),
      behavior: prefersReduced ? "auto" : "smooth"
    });
  };

  return (
    <section className="updates" id={section.id ?? "updates"}>
      <div className="container updates-header">
        {section.kicker ? <p className="updates-kicker">{section.kicker}</p> : null}
        {section.title ? <h2>{section.title}</h2> : null}
        {section.description ? (
          <p className="updates-description">{section.description}</p>
        ) : null}
      </div>

      <div className="updates-carousel">
        <button
          className="carousel-btn prev"
          type="button"
          aria-label="Scroll updates left"
          onClick={() => handleScroll(-1)}
        >
          <Icon name="arrow-left" size={18} />
        </button>

        <div className="updates-track" ref={trackRef}>
          {items.map((item, index) => (
            <article className="update-card" key={`${item.title}-${index}`}>
              <div className="update-image">
                {item.image?.src ? (
                  <img
                    src={item.image.src}
                    alt={item.image.alt ?? ""}
                    loading="lazy"
                  />
                ) : (
                  <div className="update-placeholder" aria-hidden="true"></div>
                )}
              </div>
              <div className="update-body">
                {item.title ? <h3>{item.title}</h3> : null}
                {item.description ? <p>{item.description}</p> : null}
                {item.link?.label ? (
                  <a className="update-link" href={item.link.href ?? "#"}>
                    {item.link.label}
                    <Icon name="arrow-right" size={16} />
                  </a>
                ) : null}
              </div>
            </article>
          ))}
        </div>

        <button
          className="carousel-btn next"
          type="button"
          aria-label="Scroll updates right"
          onClick={() => handleScroll(1)}
        >
          <Icon name="arrow-right" size={18} />
        </button>
      </div>
    </section>
  );
}
