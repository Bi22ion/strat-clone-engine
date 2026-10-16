type PageProps = {
  params: Promise<{ username?: string }>;
};

import UsernamePageClient from './UsernamePageClient';

export default async function UserGiftWebsitePage({ params }: PageProps) {
  const resolved = await params;
  const username = resolved?.username ?? '';
  return <UsernamePageClient username={username} />;
}
