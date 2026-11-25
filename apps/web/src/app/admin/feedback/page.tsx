import { AdminSectionPage } from '../_components/admin-section-page';
import { FeedbackSection } from '../_components/feedback-section';

export default function FeedbackPage() {
  return (
    <AdminSectionPage section="feedback">
      <FeedbackSection />
    </AdminSectionPage>
  );
}
