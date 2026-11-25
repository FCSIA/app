'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCurrentUser } from '@/lib/auth';
import { adminAccessFor, adminSectionHref, resolveAdminSection } from '@/lib/admin-sections';
import { AdminLoading } from './admin-loading';

function RedirectEffect({ requested }: { requested?: string }) {
  const user = useCurrentUser();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!user) return;

    const params = new URLSearchParams(searchParams?.toString());
    const section = resolveAdminSection(requested ?? params.get('tab'), adminAccessFor(user));
    params.delete('tab');
    router.replace(section ? adminSectionHref(section, params) : '/');
  }, [requested, router, searchParams, user]);

  return null;
}

export function AdminRedirect({ requested }: { requested?: string }) {
  return (
    <>
      <AdminLoading />
      <Suspense>
        <RedirectEffect requested={requested} />
      </Suspense>
    </>
  );
}
