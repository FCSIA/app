'use client';

import type { ReactNode } from 'react';
import { useCurrentUser } from '@/lib/auth';
import { adminAccessFor, visibleAdminSections, type AdminSectionId } from '@/lib/admin-sections';
import { AdminLoading } from './admin-loading';
import { AdminPageLayout } from './admin-page-layout';
import { AdminRedirect } from './admin-redirect';
import { AdminScrollPanel } from './admin-scroll-panel';

export function AdminSectionPage({ section, children }: {
  section: AdminSectionId;
  children: ReactNode;
}) {
  const user = useCurrentUser();
  const destination = visibleAdminSections(adminAccessFor(user)).find(({ id }) => id === section);

  if (!user) return <AdminLoading />;
  if (!destination) return <AdminRedirect requested={section} />;

  return (
    <AdminPageLayout title={destination.label}>
      <AdminScrollPanel label={destination.label}>{children}</AdminScrollPanel>
    </AdminPageLayout>
  );
}
