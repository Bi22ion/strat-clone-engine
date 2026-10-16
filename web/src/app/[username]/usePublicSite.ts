'use client';

import { useEffect, useState } from 'react';
import { gatekeeper, GatekeeperProfile, GatekeeperBlock } from '@/lib/api';

export function parseTheme(profile: GatekeeperProfile | null): { primary: string } {
  if (!profile) return { primary: '#10b981' };
  let theme = profile.theme;
  if (typeof theme === 'string') {
    try { theme = JSON.parse(theme); } catch { theme = {}; }
  }
  const t = (theme || {}) as { primary_color?: string };
  return { primary: t.primary_color || '#10b981' };
}

export function parseSocialLinks(profile: GatekeeperProfile | null): Record<string, string> {
  if (!profile) return {};
  let links = profile.social_links;
  if (typeof links === 'string') {
    try { links = JSON.parse(links); } catch { links = {}; }
  }
  return (links || {}) as Record<string, string>;
}

export function usePublicSite(username: string) {
  const [profile, setProfile] = useState<GatekeeperProfile | null>(null);
  const [blocks, setBlocks] = useState<GatekeeperBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    gatekeeper.getSite(username)
      .then((data) => {
        setProfile(data.profile);
        setBlocks(data.blocks || []);
      })
      .catch((err) => {
        setError(err?.message || 'Site not found');
      })
      .finally(() => setLoading(false));
  }, [username]);

  const visibleBlocks = blocks.filter((b) => b.is_visible).sort((a, b) => a.sort_order - b.sort_order);
  return { profile, blocks: visibleBlocks, loading, error };
}
