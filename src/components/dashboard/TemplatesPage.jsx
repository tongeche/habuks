import OrganizationPage from "./OrganizationPage.jsx";

export default function TemplatesPage({
  user,
  tenantRole,
  tenantId,
  tenant,
  onTenantUpdated,
  setActivePage,
}) {
  return (
    <OrganizationPage
      user={user}
      tenantRole={tenantRole}
      tenantId={tenantId}
      tenant={tenant}
      requestedTab="templates"
      standaloneTab="templates"
      onTenantUpdated={onTenantUpdated}
      setActivePage={setActivePage}
    />
  );
}
