import { useMemo, useState } from "react";
import SiteHeader from "./SiteHeader.jsx";
import SiteFooter from "./SiteFooter.jsx";

const getLandingData = () => {
  if (typeof window !== "undefined" && window.landingData) {
    return window.landingData();
  }
  return {};
};

const INITIAL_FORM = {
  email: "",
  firstName: "",
  lastName: "",
  country: "",
  helpNeed: "",
  company: "",
  industry: "",
  phone: "",
  employees: "",
  role: "",
};

export default function RequestDemoPage() {
  const data = useMemo(getLandingData, []);
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState(INITIAL_FORM);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleNext = (event) => {
    event.preventDefault();
    setStep(2);
  };

  const handleBack = () => setStep(1);

  const handleSubmit = (event) => {
    event.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="app-shell request-demo-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <SiteHeader data={data} hideTopBar />
      <main id="main" className="page-body request-demo-page">
        <section className="request-demo-hero">
          <div className="container request-demo-inner">
            <div className="request-demo-copy">
              <p className="landing-kicker">REQUEST A DEMO</p>
              <h1>See what Habuks can do for your collective</h1>
              <p className="landing-description">
                Book a demo and we will show you how Habuks keeps multi-tenant operations organized,
                transparent, and easy to manage.
              </p>
              <h2>What can I expect?</h2>
              <ul className="request-demo-list">
                <li>A walkthrough tailored to your organization and workflows</li>
                <li>Live visibility into projects, welfare, and reports</li>
                <li>Clear guidance on onboarding and setup</li>
              </ul>
              <p className="request-demo-note">No credit card required. We promise.</p>
            </div>

            <div className="request-demo-card">
              {!submitted ? (
                <>
                  <p className="request-demo-step">Step {step} of 2</p>
                  <h3>Request a Habuks demo</h3>
                  <p className="request-demo-helper">* indicates required fields</p>
                  {step === 1 ? (
                    <form className="request-demo-form" onSubmit={handleNext}>
                      <label className="request-field">
                        <span>Business email address *</span>
                        <input
                          type="email"
                          name="email"
                          value={formData.email}
                          onChange={handleChange}
                          required
                        />
                      </label>
                      <label className="request-field">
                        <span>First name *</span>
                        <input
                          type="text"
                          name="firstName"
                          value={formData.firstName}
                          onChange={handleChange}
                          required
                        />
                      </label>
                      <label className="request-field">
                        <span>Last name *</span>
                        <input
                          type="text"
                          name="lastName"
                          value={formData.lastName}
                          onChange={handleChange}
                          required
                        />
                      </label>
                      <label className="request-field">
                        <span>Country *</span>
                        <select
                          name="country"
                          value={formData.country}
                          onChange={handleChange}
                          required
                        >
                          <option value="">Select…</option>
                          <option value="Kenya">Kenya</option>
                          <option value="Uganda">Uganda</option>
                          <option value="Tanzania">Tanzania</option>
                          <option value="Rwanda">Rwanda</option>
                          <option value="Other">Other</option>
                        </select>
                      </label>
                      <label className="request-field">
                        <span>How can we help you? *</span>
                        <select
                          name="helpNeed"
                          value={formData.helpNeed}
                          onChange={handleChange}
                          required
                        >
                          <option value="">Select…</option>
                          <option value="Operations">Operations tracking</option>
                          <option value="Welfare">Welfare and contributions</option>
                          <option value="Projects">Projects and IGAs</option>
                          <option value="Reporting">Reporting and oversight</option>
                        </select>
                      </label>
                      <button type="submit" className="request-demo-btn">
                        Next step
                      </button>
                    </form>
                  ) : (
                    <form className="request-demo-form" onSubmit={handleSubmit}>
                      <label className="request-field">
                        <span>Organization *</span>
                        <input
                          type="text"
                          name="company"
                          value={formData.company}
                          onChange={handleChange}
                          required
                        />
                      </label>
                      <label className="request-field">
                        <span>Industry *</span>
                        <select
                          name="industry"
                          value={formData.industry}
                          onChange={handleChange}
                          required
                        >
                          <option value="">Please select…</option>
                          <option value="Cooperative">Cooperative</option>
                          <option value="NGO">NGO</option>
                          <option value="Self-help">Self-help group</option>
                          <option value="Micro-enterprise">Micro-enterprise</option>
                        </select>
                      </label>
                      <label className="request-field">
                        <span>Phone number *</span>
                        <input
                          type="tel"
                          name="phone"
                          value={formData.phone}
                          onChange={handleChange}
                          required
                        />
                      </label>
                      <label className="request-field">
                        <span>Number of members *</span>
                        <select
                          name="employees"
                          value={formData.employees}
                          onChange={handleChange}
                          required
                        >
                          <option value="">Please select…</option>
                          <option value="1-10">1-10</option>
                          <option value="11-30">11-30</option>
                          <option value="31-75">31-75</option>
                          <option value="76+">76+</option>
                        </select>
                      </label>
                      <label className="request-field">
                        <span>What is your role? *</span>
                        <select
                          name="role"
                          value={formData.role}
                          onChange={handleChange}
                          required
                        >
                          <option value="">Please select…</option>
                          <option value="Chair">Chairperson</option>
                          <option value="Treasurer">Treasurer</option>
                          <option value="Coordinator">Coordinator</option>
                          <option value="Operations">Operations lead</option>
                        </select>
                      </label>
                      <div className="request-demo-actions">
                        <button type="button" className="request-demo-link" onClick={handleBack}>
                          Back
                        </button>
                        <button type="submit" className="request-demo-btn">
                          Request a demo
                        </button>
                      </div>
                    </form>
                  )}
                </>
              ) : (
                <div className="request-demo-success">
                  <h3>Thanks for requesting a demo!</h3>
                  <p>We will reach out shortly. In the meantime, explore the live demo workspace.</p>
                  <a className="request-demo-btn" href="/demo">
                    Continue to demo
                  </a>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
      <SiteFooter data={data} />
    </div>
  );
}
