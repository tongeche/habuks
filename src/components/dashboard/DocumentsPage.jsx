export default function DocumentsPage({ user }) {
  const documents = [
    { id: 1, name: "JONGOL Constitution", type: "Constitution", uploadedAt: "2025-08-01", fileUrl: "#" },
    { id: 2, name: "Group Bylaws", type: "Bylaws", uploadedAt: "2025-08-01", fileUrl: "#" },
    { id: 3, name: "Welfare Policy", type: "Policy", uploadedAt: "2025-09-15", fileUrl: "#" },
    { id: 4, name: "Contribution Agreement Template", type: "Template", uploadedAt: "2025-10-10", fileUrl: "#" },
    { id: 5, name: "Project Proposal Template", type: "Template", uploadedAt: "2025-11-05", fileUrl: "#" },
  ];

  return (
    <div className="documents-page">
      <div className="documents-table-wrap">
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
                  <span className={`type-badge ${doc.type.toLowerCase()}`}>{doc.type}</span>
                </td>
                <td>{doc.uploadedAt}</td>
                <td>
                  <a href={doc.fileUrl} className="doc-download-btn" target="_blank" rel="noopener noreferrer">
                    Download
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
