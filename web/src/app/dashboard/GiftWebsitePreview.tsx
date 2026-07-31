'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Globe, Sparkles, ExternalLink, Loader as Loader2, Play, Image as ImageIcon } from 'lucide-react';
import { gatekeeper, GatekeeperProfile, GatekeeperBlock } from '@/lib/api';

function parseTheme(profile: GatekeeperProfile): { primary: string; layout: string } {
  let theme = profile.theme;
  if (typeof theme === 'string') {
    try { theme = JSON.parse(theme); } catch { theme = {}; }
  }
  const t = (theme || {}) as { primary_color?: string; layout?: string };
  return { primary: t.primary_color || '#10b981', layout: t.layout || 'stacked' };
}

export default function GiftWebsitePreview() {
  const [profile, setProfile] = useState<GatekeeperProfile | null>(null);
  const [blocks, setBlocks] = useState<GatekeeperBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    gatekeeper.getProfile()
      .then((data) => {
        setProfile(data.profile);
        setBlocks(data.blocks || []);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const { primary } = profile ? parseTheme(profile) : { primary: '#10b981' };
  const heroBlock = blocks.find((b) => b.block_type === 'hero');
  const statsBlock = blocks.find((b) => b.block_type === 'stats');
  const videoBlock = blocks.find((b) => b.block_type === 'video');
  const ctaBlock = blocks.find((b) => b.block_type === 'cta');
  const published = profile?.is_published;

  return (
    <div className="card-hover group">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-emerald-500/10">
            <Sparkles className="w-5 h-5 text-accent-green" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Your Gift Website</h3>
            <p className="text-xs text-zinc-500">Promote your trades 24/7</p>
          </div>
        </div>
        <Link
          href="/gatekeeper"
          className="text-xs text-accent-cyan hover:underline flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          Customize <ExternalLink className="w-3 h-3" />
        </Link>
      </div>

      <div className="rounded-lg border border-border overflow-hidden bg-zinc-950">
        <div className="h-7 bg-zinc-900 flex items-center gap-1.5 px-3 border-b border-border">
          <span className="w-2 h-2 rounded-full bg-red-500/70" />
          <span className="w-2 h-2 rounded-full bg-amber-500/70" />
          <span className="w-2 h-2 rounded-full bg-emerald-500/70" />
          <span className="ml-2 text-[10px] text-zinc-500 font-mono truncate">
            {profile ? `strat-clone.app/${profile.slug}` : 'loading…'}
          </span>
          {published && (
            <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> LIVE
            </span>
          )}
        </div>

        <div className="max-h-72 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 text-zinc-600 animate-spin" />
            </div>
          ) : error ? (
            <div className="text-center py-10 px-4">
              <Globe className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
              <p className="text-sm text-zinc-400">Your gift site is being prepared</p>
              <Link href="/gatekeeper" className="text-xs text-accent-cyan hover:underline mt-2 inline-block">
                Set up your profile →
              </Link>
            </div>
          ) : (
            <div className="p-4">
              <div className="mb-4">
                <div
                  className="h-16 rounded-md mb-3 flex items-center justify-center"
                  style={{ background: `linear-gradient(135deg, ${primary}33, ${primary}11)` }}
                >
                  <Globe className="w-6 h-6" style={{ color: primary }} />
                </div>
                <h4 className="font-bold text-sm">
                  {profile?.display_name || 'Your Name'}
                </h4>
                <p className="text-xs text-zinc-400">{profile?.tagline || 'Your tagline here'}</p>
              </div>

              {heroBlock && (
                <p className="text-xs text-zinc-300 mb-3 leading-relaxed">{heroBlock.content}</p>
              )}

              {statsBlock && (
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {['Win Rate', 'R/R', 'Trades'].map((label) => (
                    <div key={label} className="bg-zinc-900 rounded p-2 text-center">
                      <p className="text-sm font-bold mono-data" style={{ color: primary }}>—</p>
                      <p className="text-[9px] text-zinc-500">{label}</p>
                    </div>
                  ))}
                </div>
              )}

              {videoBlock && (
                <div className="mb-3 rounded-md bg-zinc-900 border border-border p-3 flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: `${primary}22` }}>
                    <Play className="w-4 h-4" style={{ color: primary }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{videoBlock.title}</p>
                    <p className="text-[10px] text-zinc-500">{videoBlock.content}</p>
                  </div>
                </div>
              )}

              {ctaBlock && (
                <button
                  className="w-full py-2 rounded-md text-xs font-medium text-white transition-opacity hover:opacity-90"
                  style={{ background: primary }}
                >
                  {ctaBlock.title}
                </button>
              )}

              {!published && (
                <p className="text-[10px] text-zinc-500 text-center mt-3 flex items-center justify-center gap-1">
                  <ImageIcon className="w-3 h-3" /> Draft — publish from the Gatekeeper
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <Link
        href="/gatekeeper"
        className="mt-3 flex items-center justify-center gap-1.5 text-xs text-zinc-400 hover:text-accent-cyan transition-colors py-1"
      >
        <Sparkles className="w-3.5 h-3.5" /> Open Gatekeeper CMS
      </Link>
    </div>
  );
}
