import { AdminSectionPage } from '../_components/admin-section-page';
import { WrappedSnapshotsSection } from '../_components/wrapped-snapshots-section';

export default function WrappedSnapshotsPage() {
  return (
    <AdminSectionPage section="wrapped">
      <WrappedSnapshotsSection />
    </AdminSectionPage>
  );
}
