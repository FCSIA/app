'use client';

import { useQuery } from '@/lib/convex-react';
import { api } from '~/apps/convex/src/_generated/api';

/** Shares the report queue subscription with the moderation section. */
export function useAdminModerationPending(enabled = true) {
  const reports = useQuery(api.moderation.reports.list, enabled ? {} : 'skip');
  return reports?.filter((report) => report.status === 'PENDING').length ?? 0;
}
