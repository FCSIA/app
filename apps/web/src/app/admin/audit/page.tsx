import { AdminSectionPage } from '../_components/admin-section-page';
import { AuditSection } from '../_components/audit/audit-section';

export default function AuditPage() {
  return (
    <AdminSectionPage section="audit">
      <AuditSection />
    </AdminSectionPage>
  );
}
