import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App.jsx";
import LoginPage from "./components/LoginPage.jsx";
import RegisterPage from "./components/RegisterPage.jsx";
import VolunteerPage from "./components/VolunteerPage.jsx";
import AboutPage from "./components/AboutPage.jsx";
import ProjectPage from "./components/ProjectPage.jsx";
import Dashboard from "./components/dashboard/Dashboard.jsx";
import "./styles.css";

// Import Supabase test functions for console testing
import { testSupabaseConnection, fetchMembers, fetchPayoutSchedule } from "./lib/supabaseTest.js";
window.testSupabase = testSupabaseConnection;
window.fetchMembers = fetchMembers;
window.fetchPayoutSchedule = fetchPayoutSchedule;

const rootElement = document.getElementById("root");

if (rootElement) {
  createRoot(rootElement).render(
    <React.StrictMode>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/volunteer" element={<VolunteerPage />} />
          <Route path="/projects/:projectCode" element={<ProjectPage />} />
          <Route path="/dashboard/*" element={<Dashboard />} />
        </Routes>
      </BrowserRouter>
    </React.StrictMode>
  );
}
