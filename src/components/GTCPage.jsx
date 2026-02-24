import { useEffect, useMemo, useState } from "react";
import SiteHeader from "./SiteHeader.jsx";
import SiteFooter from "./SiteFooter.jsx";

const getLandingData = () => {
  if (typeof window !== "undefined" && window.landingData) {
    return window.landingData();
  }
  return {};
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");

const renderInline = (value) => {
  let text = escapeHtml(value);
  text = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/\*(.+?)\*/g, "<em>$1</em>");
  text = text.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');
  return text;
};

const markdownToHtml = (source) => {
  const lines = source.split(/\r?\n/);
  let html = "";
  let inList = false;
  let listType = "ul";

  const closeList = () => {
    if (inList) {
      html += `</${listType}>`;
      inList = false;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      closeList();
      continue;
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      closeList();
      const level = headingMatch[1].length;
      html += `<h${level}>${renderInline(headingMatch[2])}</h${level}>`;
      continue;
    }

    const quoteMatch = line.match(/^>\s+(.*)$/);
    if (quoteMatch) {
      closeList();
      html += `<blockquote>${renderInline(quoteMatch[1])}</blockquote>`;
      continue;
    }

    const listMatch = line.match(/^[-*]\s+(.*)$/);
    if (listMatch) {
      if (!inList || listType !== "ul") {
        closeList();
        html += "<ul>";
        inList = true;
        listType = "ul";
      }
      html += `<li>${renderInline(listMatch[1])}</li>`;
      continue;
    }

    const orderedMatch = line.match(/^\d+\.\s+(.*)$/);
    if (orderedMatch) {
      if (!inList || listType !== "ol") {
        closeList();
        html += "<ol>";
        inList = true;
        listType = "ol";
      }
      html += `<li>${renderInline(orderedMatch[1])}</li>`;
      continue;
    }

    closeList();
    html += `<p>${renderInline(line)}</p>`;
  }

  closeList();
  return html;
};

export default function GTCPage() {
  const data = useMemo(getLandingData, []);
  const [content, setContent] = useState("");

  useEffect(() => {
    fetch("/gtc.md")
      .then((res) => res.text())
      .then((text) => setContent(text))
      .catch(() => setContent(""));
  }, []);

  const { title, lastUpdated, body } = useMemo(() => {
    const lines = content.split(/\r?\n/);
    let pageTitle = "General Terms and Conditions";
    let updated = "";
    const bodyLines = [];

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) {
        bodyLines.push(rawLine);
        continue;
      }

      const headingMatch = line.match(/^#\s+(.*)$/);
      if (headingMatch && pageTitle === "General Terms and Conditions") {
        const headingText = headingMatch[1].trim();
        if (headingText.toLowerCase().includes("general terms")) {
          pageTitle = headingText;
        }
        continue;
      }

      const updatedMatch = line.match(/^(?:_|\*)?\s*Last update(?:d)?\s*:\s*(.*)$/i);
      if (updatedMatch && !updated) {
        updated = updatedMatch[1].trim();
        continue;
      }

      bodyLines.push(rawLine);
    }

    return {
      title: pageTitle,
      lastUpdated: updated,
      body: bodyLines.join("\n")
    };
  }, [content]);

  const html = useMemo(() => markdownToHtml(body), [body]);

  return (
    <div className="app-shell gtc-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <SiteHeader data={data} />
      <main id="main" className="policy-page">
        <section className="policy-hero">
          <div className="container policy-hero-inner">
            <h1>{title}</h1>
            {lastUpdated ? <p className="policy-updated">Last updated: {lastUpdated}</p> : null}
          </div>
        </section>

        <section className="policy-body">
          <div className="container">
            <div
              className="policy-content"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </div>
        </section>
      </main>
      <SiteFooter data={data} />
    </div>
  );
}
