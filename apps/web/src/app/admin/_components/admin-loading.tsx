import { Skeleton } from '@/components/ui/skeleton';
import { AdminPageLayout } from './admin-page-layout';

export function AdminLoading() {
  return (
    <AdminPageLayout title="Admin">
      <Skeleton className="h-48" />
    </AdminPageLayout>
  );
}
