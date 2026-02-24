import { useRef } from "react";
import { Icon } from "./icons.jsx";

export default function TestimonialsSlider({ data }) {
  const section = data?.testimonialsSection ?? {};
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

    const card = track.querySelector(".testimonial-card");
    const cardWidth = card ? card.getBoundingClientRect().width : 280;
    const gap = 24;
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    track.scrollBy({
      left: direction * (cardWidth + gap),
      behavior: prefersReduced ? "auto" : "smooth",
    });
  };

  return (
    <section className="testimonials" id={section.id ?? "testimonials"}>
      <div className="container testimonials-header">
        {section.kicker ? <p className="testimonials-kicker">{section.kicker}</p> : null}
        {section.title ? <h2>{section.title}</h2> : null}
        {section.description ? (
          <p className="testimonials-description">{section.description}</p>
        ) : null}
      </div>

      <div className="testimonials-carousel">
        <button
          className="carousel-btn prev"
          type="button"
          aria-label="Scroll testimonials left"
          onClick={() => handleScroll(-1)}
        >
          <Icon name="arrow-left" size={18} />
        </button>

        <div className="testimonials-track" ref={trackRef}>
          {items.map((item, index) => (
            <article className="testimonial-card" key={`${item.name}-${index}`}>
              <div className="testimonial-quote">
                <span className="testimonial-mark" aria-hidden="true">“</span>
                <p>{item.quote}</p>
              </div>
              <div className="testimonial-author">
                <div className="author-avatar">
                  {item.avatar?.src ? (
                    <img src={item.avatar.src} alt={item.avatar.alt ?? ""} loading="lazy" />
                  ) : (
                    <span>{item.name ? item.name.charAt(0) : "?"}</span>
                  )}
                </div>
                <div>
                  {item.name ? <p className="author-name">{item.name}</p> : null}
                  {item.role ? <p className="author-role">{item.role}</p> : null}
                </div>
              </div>
            </article>
          ))}
        </div>

        <button
          className="carousel-btn next"
          type="button"
          aria-label="Scroll testimonials right"
          onClick={() => handleScroll(1)}
        >
          <Icon name="arrow-right" size={18} />
        </button>
      </div>
    </section>
  );
}
