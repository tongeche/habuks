import NewProjectFormDemo from "./steps-demos/NewProjectFormDemo.jsx";

export default function StepsRenderPage() {
  return (
    <div className="steps-render-page">
      <main className="steps-render-main" id="main">
        <section className="steps-render-intro">
          <p className="steps-render-kicker">DEMO SANDBOX</p>
          <h1>Interactive steps render page</h1>
          <p>
            Scroll to trigger the animation. This page is for validating timeline behavior before
            mounting demos in landing cards.
          </p>
        </section>

        <div className="steps-render-spacer" aria-hidden="true" />

        <section className="steps-render-demo-block" aria-label="New project demo preview">
          <header>
            <h2>Step model: Manage projects and finances</h2>
            <p>Uses the real project form view with a timeline-driven demo state machine.</p>
          </header>
          <NewProjectFormDemo />
        </section>

        <div className="steps-render-spacer" aria-hidden="true" />
      </main>
    </div>
  );
}
