import { AdminSectionPage } from '../_components/admin-section-page';
import { UsersSection } from '../_components/users/users-section';

export default function UsersPage() {
  return (
    <AdminSectionPage section="users">
      <UsersSection />
    </AdminSectionPage>
  );
}
