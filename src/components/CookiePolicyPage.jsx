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

const parseParagraphs = (lines) => {
  const paragraphs = [];
  let buffer = [];
  lines.forEach((raw) => {
    const line = raw.trim();
    if (!line) {
      if (buffer.length) {
        paragraphs.push(renderInline(buffer.join(" ")));
        buffer = [];
      }
      return;
    }
    buffer.push(line);
  });
  if (buffer.length) {
    paragraphs.push(renderInline(buffer.join(" ")));
  }
  return paragraphs;
};

const parseTable = (lines, startIndex) => {
  const headerLine = lines[startIndex] ?? "";
  const headerCells = headerLine
    .split("|")
    .map((cell) => cell.trim())
    .filter(Boolean);

  const rows = [];
  let index = startIndex + 2;
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim().startsWith("|")) {
      break;
    }
    const cells = line
      .split("|")
      .map((cell) => cell.trim())
      .filter(Boolean)
      .map((cell) => cell.replace(/^`|`$/g, ""));
    if (cells.length) {
      rows.push(cells);
    }
    index += 1;
  }

  return { headerCells, rows, endIndex: index };
};

const parseDefinitions = (lines, startIndex) => {
  const definitions = [];
  let index = startIndex;
  let current = null;
  let buffer = [];

  const flush = () => {
    if (current) {
      definitions.push({ title: current, description: renderInline(buffer.join(" ")) });
    }
    current = null;
    buffer = [];
  };

  while (index < lines.length) {
    const line = lines[index].trim();
    if (!line) {
      if (buffer.length) {
        buffer.push("");
      }
      index += 1;
      continue;
    }
    if (line.startsWith("## ")) {
      if (current) {
        flush();
      }
      break;
    }
    const boldMatch = line.match(/^\*\*(.+)\*\*$/);
    if (boldMatch) {
      if (current) {
        flush();
      }
      current = boldMatch[1].trim();
      index += 1;
      continue;
    }
    buffer.push(line);
    index += 1;
  }

  if (current) {
    flush();
  }

  return { definitions, endIndex: index };
};

const parseImportant = (lines, startIndex) => {
  const paragraphs = [];
  const bullets = [];
  let index = startIndex;

  while (index < lines.length) {
    const line = lines[index].trim();
    if (!line) {
      index += 1;
      continue;
    }
    if (line.startsWith("#")) {
      break;
    }
    const bulletMatch = line.match(/^[-*]\s+(.*)$/);
    if (bulletMatch) {
      bullets.push(renderInline(bulletMatch[1]));
      index += 1;
      continue;
    }
    paragraphs.push(renderInline(line));
    index += 1;
  }

  return { paragraphs, bullets };
};

export default function CookiePolicyPage() {
  const data = useMemo(getLandingData, []);
  const [content, setContent] = useState("");

  useEffect(() => {
    fetch("/cookie-policy.md")
      .then((res) => res.text())
      .then((text) => setContent(text))
      .catch(() => setContent(""));
  }, []);

  const { title, lastUpdated, intro, table, definitions, important } = useMemo(() => {
    const lines = content.split(/\r?\n/);
    let pageTitle = "Cookie Policy";
    let updated = "";
    let introLines = [];
    let tableData = null;
    let definitionsData = [];
    let importantData = { paragraphs: [], bullets: [] };

    let index = 0;
    while (index < lines.length) {
      const line = lines[index].trim();
      if (!line) {
        index += 1;
        continue;
      }
      const headingMatch = line.match(/^#\s+(.*)$/);
      if (headingMatch && pageTitle === "Cookie Policy") {
        pageTitle = headingMatch[1].trim();
        index += 1;
        continue;
      }
      const updatedMatch = line.match(/^(?:_|\*)?\s*Last update(?:d)?\s*:\s*(.*)$/i);
      if (updatedMatch && !updated) {
        updated = updatedMatch[1].trim();
        index += 1;
        continue;
      }
      if (line.startsWith("|") && line.includes("Cookie Name")) {
        tableData = parseTable(lines, index);
        index = tableData.endIndex;
        continue;
      }
      if (line.startsWith("## Column Definitions")) {
        const parsed = parseDefinitions(lines, index + 1);
        definitionsData = parsed.definitions;
        index = parsed.endIndex;
        continue;
      }
      if (line.startsWith("Important:")) {
        importantData = parseImportant(lines, index + 1);
        break;
      }
      introLines.push(lines[index]);
      index += 1;
    }

    return {
      title: pageTitle,
      lastUpdated: updated,
      intro: parseParagraphs(introLines),
      table: tableData ? { headers: tableData.headerCells, rows: tableData.rows } : null,
      definitions: definitionsData,
      important: importantData
    };
  }, [content]);

  return (
    <div className="app-shell policy-shell policy-shell--cookie">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <SiteHeader data={data} />
      <main id="main" className="policy-page policy-page--cookie">
        <section className="policy-hero">
          <div className="container policy-hero-inner">
            <h1>{title}</h1>
            {lastUpdated ? <p className="policy-updated">Last update: {lastUpdated}</p> : null}
          </div>
        </section>

        <section className="policy-body">
          <div className="container">
            <div className="policy-content">
              {intro.length ? (
                <div className="policy-intro">
                  {intro.map((paragraph, idx) => (
                    <p key={`intro-${idx}`} dangerouslySetInnerHTML={{ __html: paragraph }} />
                  ))}
                </div>
              ) : null}

              {table ? (
                <div className="policy-table-wrap">
                  <h2>Cookie Policy</h2>
                  <table className="policy-table">
                    <thead>
                      <tr>
                        {table.headers.map((header) => (
                          <th key={header}>{header}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {table.rows.map((row, rowIndex) => (
                        <tr key={`row-${rowIndex}`}>
                          {row.map((cell, cellIndex) => (
                            <td
                              key={`cell-${rowIndex}-${cellIndex}`}
                              dangerouslySetInnerHTML={{ __html: renderInline(cell) }}
                            />
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}

              {definitions.length ? (
                <div className="policy-definitions">
                  <h2>Column Definitions</h2>
                  {definitions.map((item) => (
                    <div className="policy-definition" key={item.title}>
                      <h3>{item.title}</h3>
                      <p dangerouslySetInnerHTML={{ __html: item.description }} />
                    </div>
                  ))}
                </div>
              ) : null}

              {important.paragraphs.length || important.bullets.length ? (
                <div className="policy-important">
                  <h3>Important</h3>
                  {important.paragraphs.map((paragraph, idx) => (
                    <p key={`important-${idx}`} dangerouslySetInnerHTML={{ __html: paragraph }} />
                  ))}
                  {important.bullets.length ? (
                    <ul>
                      {important.bullets.map((item, idx) => (
                        <li key={`important-bullet-${idx}`} dangerouslySetInnerHTML={{ __html: item }} />
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </main>
      <SiteFooter data={data} />
    </div>
  );
}
