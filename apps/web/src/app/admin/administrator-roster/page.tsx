import { AdminSectionPage } from '../_components/admin-section-page';
import { AdministratorRosterSection } from '../_components/administrator-roster-section';

export default function AdministratorRosterPage() {
  return (
    <AdminSectionPage section="administrator-roster">
      <AdministratorRosterSection />
    </AdminSectionPage>
  );
}
