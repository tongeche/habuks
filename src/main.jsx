import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./styles.css";
import App from "./App.jsx";
import LandingPage from "./components/LandingPage.jsx";
import LoginPage from "./components/LoginPage.jsx";
import RegisterPage from "./components/RegisterPage.jsx";
import AboutPage from "./components/AboutPage.jsx";
import TenantSignupPage from "./components/TenantSignupPage.jsx";
import TenantSelectPage from "./components/TenantSelectPage.jsx";
import DemoPage from "./components/DemoPage.jsx";
import DemoLandingPage from "./components/DemoLandingPage.jsx";
import RequestDemoPage from "./components/RequestDemoPage.jsx";
import SupportPage from "./components/SupportPage.jsx";
import PrivacyPolicyPage from "./components/PrivacyPolicyPage.jsx";
import CookiePolicyPage from "./components/CookiePolicyPage.jsx";
import GTCPage from "./components/GTCPage.jsx";
import BlogPage from "./components/BlogPage.jsx";
import BlogPostPage from "./components/BlogPostPage.jsx";
import ResourcesListPage from "./components/ResourcesListPage.jsx";
import ResourcePage from "./components/ResourcePage.jsx";
import Dashboard from "./components/dashboard/Dashboard.jsx";
import StepsRenderPage from "./components/StepsRenderPage.jsx";
import { startErrorReporter } from "./lib/errorReporter.js";

// Import Supabase test functions for console testing
import { testSupabaseConnection, fetchMembers, fetchPayoutSchedule } from "./lib/supabaseTest.js";
window.testSupabase = testSupabaseConnection;
window.fetchMembers = fetchMembers;
window.fetchPayoutSchedule = fetchPayoutSchedule;

const rootElement = document.getElementById("root");

startErrorReporter();

if (import.meta.env.DEV && "serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => registration.unregister());
  });
  if ("caches" in window) {
    caches.keys().then((keys) => keys.forEach((key) => caches.delete(key)));
  }
}

if (rootElement) {
  createRoot(rootElement).render(
    <React.StrictMode>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/tenant" element={<App />} />
          <Route path="/tenant/:slug" element={<App />} />
          <Route path="/tenant/:slug/dashboard/*" element={<Dashboard />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/blog" element={<BlogPage />} />
          <Route path="/blog/:slug" element={<BlogPostPage />} />
          <Route path="/resources" element={<ResourcesListPage />} />
          <Route path="/resources/:slug" element={<ResourcePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/join" element={<RegisterPage />} />
          <Route path="/get-started" element={<TenantSignupPage />} />
          <Route path="/request-demo" element={<RequestDemoPage />} />
          <Route path="/demo" element={<DemoPage />} />
          <Route path="/demo/landing" element={<DemoLandingPage />} />
          <Route path="/demo/steps-render" element={<StepsRenderPage />} />
          <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
          <Route path="/cookie-policy" element={<CookiePolicyPage />} />
          <Route path="/gtc" element={<GTCPage />} />
          <Route path="/support" element={<SupportPage />} />
          <Route path="/select-tenant" element={<TenantSelectPage />} />
          <Route path="/dashboard/*" element={<Dashboard />} />
        </Routes>
      </BrowserRouter>
    </React.StrictMode>
  );
}

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.error("Service worker registration failed:", error);
    });
  });
}
