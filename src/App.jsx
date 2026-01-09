import { useMemo } from "react";
import SiteHeader from "./components/SiteHeader.jsx";
import SiteFooter from "./components/SiteFooter.jsx";
import Hero from "./components/Hero.jsx";
import Highlight from "./components/Highlight.jsx";
import WhatWeDo from "./components/WhatWeDo.jsx";
import Volunteer from "./components/Volunteer.jsx";
import AboutSection from "./components/AboutSection.jsx";
import UpdatesCarousel from "./components/UpdatesCarousel.jsx";
import CtaBanner from "./components/CtaBanner.jsx";

const getSiteData = () => {
  if (typeof window !== "undefined" && window.siteData) {
    return window.siteData();
  }
  return {};
};

export default function App() {
  const data = useMemo(getSiteData, []);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <SiteHeader data={data} />
      <main id="main" className="page-body">
        <Hero data={data} />
        <Highlight data={data} />
        <WhatWeDo data={data} />
        <Volunteer data={data} />
        <AboutSection data={data} />
        <CtaBanner data={data} />
        <UpdatesCarousel data={data} />
      </main>
      <SiteFooter data={data} />
    </div>
  );
}
