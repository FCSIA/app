import { AdminSectionPage } from '../_components/admin-section-page';
import { AnalyticsSection } from '../_components/analytics/analytics-section';

export default function AnalyticsPage() {
  return (
    <AdminSectionPage section="analytics">
      <AnalyticsSection />
    </AdminSectionPage>
  );
}
