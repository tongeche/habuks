import Hero from "./Hero.jsx";
import ImpactStrip from "./ImpactStrip.jsx";
import ProgramsGrid from "./ProgramsGrid.jsx";
import ObjectivesBlock from "./ObjectivesBlock.jsx";
import TestimonialsSlider from "./TestimonialsSlider.jsx";
import CtaBanner from "./CtaBanner.jsx";
import ContactSection from "./ContactSection.jsx";

function HopeTenantSiteShell({ data }) {
  return (
    <>
      <Hero data={data} />
      <div className="tenant-site-template-one-stack">
        <ProgramsGrid data={data} />
        <ObjectivesBlock data={data} />
        <ImpactStrip data={data} />
      </div>
      <CtaBanner data={data} />
      <TestimonialsSlider data={data} />
      <ContactSection data={data} />
    </>
  );
}

export default function TenantSiteShell({ data }) {
  return <HopeTenantSiteShell data={data} />;
}
