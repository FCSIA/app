import { AdminSectionPage } from '../_components/admin-section-page';
import { StudentRosterSection } from '../_components/schedule-section';

export default function StudentRosterPage() {
  return (
    <AdminSectionPage section="schedule">
      <StudentRosterSection />
    </AdminSectionPage>
  );
}
