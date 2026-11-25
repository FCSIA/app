import { AdminSectionPage } from '../_components/admin-section-page';
import { ModerationSection } from '../_components/moderation-section';

export default function ModerationPage() {
  return (
    <AdminSectionPage section="moderation">
      <ModerationSection />
    </AdminSectionPage>
  );
}
