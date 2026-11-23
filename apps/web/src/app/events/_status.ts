import type { BadgeColor } from "@/components/ui/badge";

export function eventStatusLabel(status: string) {
  return status.replace(/_/g, ' ');
}

export function eventStatusColor(status: string): BadgeColor {
  switch (status) {
    case 'PUBLISHED': return 'emerald';
    case 'PENDING_APPROVAL': return 'amber';
    case 'CANCELLED': return 'red';
    default: return 'gray';
  }
}
