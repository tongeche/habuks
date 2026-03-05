import OrganizationPage from "./OrganizationPage.jsx";

export default function TemplatesPage({
  user,
  tenantId,
  tenant,
  onTenantUpdated,
  setActivePage,
}) {
  return (
    <OrganizationPage
      user={user}
      tenantId={tenantId}
      tenant={tenant}
      requestedTab="templates"
      standaloneTab="templates"
      onTenantUpdated={onTenantUpdated}
      setActivePage={setActivePage}
    />
  );
}
