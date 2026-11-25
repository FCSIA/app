import { AdminRedirect } from '../_components/admin-redirect';

export default async function LegacyAdminSectionPage({ params }: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  return <AdminRedirect requested={section} />;
}
