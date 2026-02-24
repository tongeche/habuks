import { useEffect, useState } from "react";
import { getDocuments } from "../../lib/dataService.js";

export default function DocumentsPage({ user, tenantId }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDocuments = async () => {
      setLoading(true);
      try {
        const data = await getDocuments(tenantId);
        setDocuments(data || []);
      } catch (error) {
        console.error("Error loading documents:", error);
        setDocuments([]);
      } finally {
        setLoading(false);
      }
    };

    loadDocuments();
  }, [tenantId]);

  if (loading) {
    return <div className="documents-page loading">Loading documents...</div>;
  }

  return (
    <div className="documents-page">
      <div className="documents-table-wrap">
        {documents.length ? (
          <table className="documents-table">
            <thead>
              <tr>
                <th>Document Name</th>
                <th>Type</th>
                <th>Uploaded</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc.id}>
                  <td>{doc.name}</td>
                  <td>
                    <span className={`type-badge ${(doc.type || "file").toLowerCase()}`}>
                      {doc.type || "File"}
                    </span>
                  </td>
                  <td>{doc.uploaded_at ? String(doc.uploaded_at).slice(0, 10) : "—"}</td>
                  <td>
                    {doc.file_url ? (
                      <a
                        href={doc.file_url}
                        className="doc-download-btn"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Download
                      </a>
                    ) : (
                      <span className="doc-download-btn is-disabled">Unavailable</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="no-data">
            <p>No documents uploaded yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
