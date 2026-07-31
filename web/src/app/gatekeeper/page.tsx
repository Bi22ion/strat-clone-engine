'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Globe, Plus, Trash2, Save, Eye, EyeOff, Loader as Loader2, GripVertical, Sparkles, Palette, LayoutGrid as Layout, Video, Type, ChartBar as BarChart3, Megaphone, CreditCard, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  gatekeeper, GatekeeperProfile, GatekeeperBlock, GatekeeperSubscription,
} from '@/lib/api';
import { useAuthGuard, getUser } from '@/lib/auth';

const BLOCK_TYPES = [
  { type: 'hero', label: 'Hero Banner', icon: Sparkles },
  { type: 'text', label: 'Text', icon: Type },
  { type: 'image', label: 'Image', icon: Layout },
  { type: 'video', label: 'Video', icon: Video },
  { type: 'stats', label: 'Stats', icon: BarChart3 },
  { type: 'trade_class', label: 'Trade Class', icon: Megaphone },
  { type: 'cta', label: 'Call to Action', icon: Megaphone },
];

const TIERS = [
  { tier: 'free' as const, label: 'Free', price: '$0', period: 'forever', desc: 'Full access during testing' },
  { tier: 'weekly' as const, label: 'Weekly', price: '$4.99', period: '/week', desc: 'Weekly subscription' },
  { tier: 'monthly' as const, label: 'Monthly', price: '$14.99', period: '/month', desc: 'Monthly subscription' },
  { tier: 'yearly' as const, label: 'Yearly', price: '$149.99', period: '/year', desc: 'Best value' },
];

const COLOR_SWATCHES = ['#10b981', '#06b6d4', '#6366f1', '#f59e0b', '#ef4444', '#ec4899'];

function parseJson<T>(value: T | string, fallback: T): T {
  if (!value) return fallback;
  if (typeof value === 'string') {
    try { return JSON.parse(value) as T; } catch { return fallback; }
  }
  return value as T;
}

export default function GatekeeperPage() {
  useAuthGuard();
  const router = useRouter();
  const user = getUser();

  const [profile, setProfile] = useState<GatekeeperProfile | null>(null);
  const [blocks, setBlocks] = useState<GatekeeperBlock[]>([]);
  const [subscription, setSubscription] = useState<GatekeeperSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [socialLinks, setSocialLinks] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const [pData, sData] = await Promise.all([
        gatekeeper.getProfile(),
        gatekeeper.getSubscription(),
      ]);
      setProfile(pData.profile);
      setBlocks(pData.blocks || []);
      setSocialLinks(parseJson(pData.profile.social_links, {}));
      setSubscription(sData.subscription);
    } catch {
      toast.error('Failed to load your Gatekeeper profile');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const theme = profile ? parseJson(profile.theme, { primary_color: '#10b981' }) : { primary_color: '#10b981' };
  const primaryColor = theme.primary_color || '#10b981';

  async function handleSaveProfile(patch: Partial<GatekeeperProfile>) {
    setSavingProfile(true);
    try {
      const { profile: updated } = await gatekeeper.updateProfile({
        ...patch,
        social_links: socialLinks,
        theme: { ...theme, ...((patch as { theme?: typeof theme }).theme || {}) },
      });
      setProfile(updated);
      toast.success('Profile saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleAddBlock(blockType: string) {
    try {
      const { block } = await gatekeeper.addBlock({
        block_type: blockType,
        title: 'New block',
        content: '',
        sort_order: blocks.length,
      });
      setBlocks([...blocks, block]);
      setActiveBlockId(block.id);
      toast.success('Block added');
    } catch {
      toast.error('Failed to add block');
    }
  }

  async function handleUpdateBlock(id: string, patch: Partial<GatekeeperBlock>) {
    setBlocks(blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)));
    try {
      await gatekeeper.updateBlock(id, patch);
    } catch {
      toast.error('Failed to save block');
      load();
    }
  }

  async function handleDeleteBlock(id: string) {
    try {
      await gatekeeper.deleteBlock(id);
      setBlocks(blocks.filter((b) => b.id !== id));
      if (activeBlockId === id) setActiveBlockId(null);
      toast.success('Block deleted');
    } catch {
      toast.error('Failed to delete block');
    }
  }

  async function handlePublish(value: boolean) {
    await handleSaveProfile({ is_published: value });
  }

  async function handleTierChange(tier: GatekeeperSubscription['tier']) {
    try {
      const { subscription: sub } = await gatekeeper.updateSubscription(tier);
      setSubscription(sub);
      toast.success(`Switched to ${tier} plan`);
    } catch {
      toast.error('Failed to change plan');
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-accent-cyan animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/dashboard')} className="text-zinc-400 hover:text-white text-sm">
              ← Dashboard
            </button>
            <span className="text-zinc-600">/</span>
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-accent-green" />
              <span className="font-bold">Gatekeeper CMS</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {profile?.is_published ? (
              <button onClick={() => handlePublish(false)} className="flex items-center gap-1.5 text-sm text-amber-400 hover:text-amber-300">
                <EyeOff className="w-4 h-4" /> Unpublish
              </button>
            ) : (
              <button onClick={() => handlePublish(true)} className="flex items-center gap-1.5 text-sm text-emerald-400 hover:text-emerald-300">
                <Eye className="w-4 h-4" /> Publish
              </button>
            )}
            {user && <span className="text-sm text-zinc-400 hidden sm:block">{user.email}</span>}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8 grid lg:grid-cols-2 gap-8 items-start">
        {/* LEFT: editor */}
        <div className="space-y-6">
          {/* Profile settings */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Palette className="w-5 h-5 text-accent-cyan" /> Profile Settings
            </h2>
            <div className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Display Name</label>
                  <input
                    className="input-field"
                    value={profile?.display_name || ''}
                    onChange={(e) => setProfile(profile ? { ...profile, display_name: e.target.value } : null)}
                    onBlur={(e) => handleSaveProfile({ display_name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">URL Slug</label>
                  <input
                    className="input-field mono-data"
                    value={profile?.slug || ''}
                    onChange={(e) => setProfile(profile ? { ...profile, slug: e.target.value } : null)}
                    onBlur={(e) => handleSaveProfile({ slug: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="label">Tagline</label>
                <input
                  className="input-field"
                  value={profile?.tagline || ''}
                  onChange={(e) => setProfile(profile ? { ...profile, tagline: e.target.value } : null)}
                  onBlur={(e) => handleSaveProfile({ tagline: e.target.value })}
                  placeholder="Sharing my edge with the world"
                />
              </div>
              <div>
                <label className="label">Bio</label>
                <textarea
                  className="input-field min-h-24"
                  value={profile?.bio || ''}
                  onChange={(e) => setProfile(profile ? { ...profile, bio: e.target.value } : null)}
                  onBlur={(e) => handleSaveProfile({ bio: e.target.value })}
                  placeholder="Tell visitors about your trading journey…"
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Avatar URL</label>
                  <input
                    className="input-field"
                    value={profile?.avatar_url || ''}
                    onChange={(e) => setProfile(profile ? { ...profile, avatar_url: e.target.value } : null)}
                    onBlur={(e) => handleSaveProfile({ avatar_url: e.target.value })}
                    placeholder="https://…"
                  />
                </div>
                <div>
                  <label className="label">Cover Image URL</label>
                  <input
                    className="input-field"
                    value={profile?.cover_url || ''}
                    onChange={(e) => setProfile(profile ? { ...profile, cover_url: e.target.value } : null)}
                    onBlur={(e) => handleSaveProfile({ cover_url: e.target.value })}
                    placeholder="https://…"
                  />
                </div>
              </div>

              <div>
                <label className="label">Accent Color</label>
                <div className="flex gap-2">
                  {COLOR_SWATCHES.map((c) => (
                    <button
                      key={c}
                      onClick={() => handleSaveProfile({ theme: { ...theme, primary_color: c } } as Partial<GatekeeperProfile>)}
                      className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${
                        primaryColor === c ? 'border-white' : 'border-transparent'
                      }`}
                      style={{ background: c }}
                      aria-label={`Accent ${c}`}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="label">Social Links</label>
                <div className="grid grid-cols-2 gap-2">
                  {['twitter', 'youtube', 'discord', 'telegram'].map((key) => (
                    <input
                      key={key}
                      className="input-field text-sm"
                      placeholder={`${key} URL`}
                      value={socialLinks[key] || ''}
                      onChange={(e) => setSocialLinks({ ...socialLinks, [key]: e.target.value })}
                      onBlur={() => handleSaveProfile({})}
                    />
                  ))}
                </div>
              </div>

              <button
                onClick={() => handleSaveProfile({})}
                className="btn-primary flex items-center gap-2"
                disabled={savingProfile}
              >
                {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Profile
              </button>
            </div>
          </div>

          {/* Block management */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Layout className="w-5 h-5 text-accent-cyan" /> Page Blocks
            </h2>

            <div className="flex flex-wrap gap-2 mb-4">
              {BLOCK_TYPES.map((bt) => (
                <button
                  key={bt.type}
                  onClick={() => handleAddBlock(bt.type)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 border border-border text-xs text-zinc-300 hover:border-accent-cyan/50 hover:text-accent-cyan transition-all"
                >
                  <bt.icon className="w-3.5 h-3.5" />
                  <Plus className="w-3 h-3" />
                  {bt.label}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              {blocks.length === 0 ? (
                <p className="text-zinc-500 text-center py-6 text-sm">No blocks yet — add one above.</p>
              ) : (
                blocks.map((block) => (
                  <div
                    key={block.id}
                    className={`rounded-lg border p-3 cursor-pointer transition-all ${
                      activeBlockId === block.id
                        ? 'border-accent-cyan/50 bg-accent-cyan/5'
                        : 'border-border bg-zinc-900/50 hover:bg-zinc-900'
                    }`}
                    onClick={() => setActiveBlockId(activeBlockId === block.id ? null : block.id)}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <GripVertical className="w-3.5 h-3.5 text-zinc-600" />
                      <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 capitalize">
                        {block.block_type}
                      </span>
                      <span className="text-sm font-medium flex-1 truncate">
                        {block.title || 'Untitled'}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteBlock(block.id); }}
                        className="text-zinc-500 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {activeBlockId === block.id && (
                      <div className="mt-3 space-y-3" onClick={(e) => e.stopPropagation()}>
                        <div>
                          <label className="label">Title</label>
                          <input
                            className="input-field text-sm"
                            value={block.title || ''}
                            onChange={(e) => handleUpdateBlock(block.id, { title: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="label">Content</label>
                          <textarea
                            className="input-field text-sm min-h-16"
                            value={block.content || ''}
                            onChange={(e) => handleUpdateBlock(block.id, { content: e.target.value })}
                          />
                        </div>
                        {(block.block_type === 'image' || block.block_type === 'video' || block.block_type === 'trade_class') && (
                          <div>
                            <label className="label">Media URL</label>
                            <input
                              className="input-field text-sm"
                              value={block.media_url || ''}
                              onChange={(e) => handleUpdateBlock(block.id, { media_url: e.target.value })}
                              placeholder="https://… (image or video URL)"
                            />
                          </div>
                        )}
                        <div className="flex items-center gap-4">
                          <label className="flex items-center gap-2 text-sm text-zinc-300">
                            <input
                              type="number"
                              className="input-field w-20 text-sm"
                              value={block.sort_order}
                              onChange={(e) => handleUpdateBlock(block.id, { sort_order: Number(e.target.value) })}
                            />
                            Order
                          </label>
                          <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={block.is_visible}
                              onChange={(e) => handleUpdateBlock(block.id, { is_visible: e.target.checked })}
                              className="accent-accent-cyan"
                            />
                            Visible
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Monetization */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-accent-cyan" /> Subscription Plan
            </h2>
            <p className="text-sm text-zinc-400 mb-4">
              Everything is free during testing. Pick a tier to prepare for launch.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {TIERS.map((t) => {
                const active = subscription?.tier === t.tier;
                return (
                  <button
                    key={t.tier}
                    onClick={() => handleTierChange(t.tier)}
                    className={`relative rounded-lg border p-3 text-left transition-all ${
                      active
                        ? 'border-accent-cyan bg-accent-cyan/10'
                        : 'border-border bg-zinc-900/50 hover:bg-zinc-900'
                    }`}
                  >
                    {active && (
                      <Check className="absolute top-2 right-2 w-4 h-4 text-accent-cyan" />
                    )}
                    <p className="font-semibold text-sm">{t.label}</p>
                    <p className="text-xs text-zinc-400 mt-1">
                      <span className="mono-data">{t.price}</span> {t.period}
                    </p>
                    <p className="text-[10px] text-zinc-500 mt-1">{t.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT: live preview */}
        <div className="lg:sticky lg:top-20">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Eye className="w-5 h-5 text-accent-green" /> Live Preview
              </h2>
              <span className="text-xs text-zinc-500">
                {profile?.is_published ? 'Published' : 'Draft'}
              </span>
            </div>

            <div className="rounded-lg border border-border overflow-hidden bg-zinc-950">
              <div className="h-8 bg-zinc-900 flex items-center gap-1.5 px-3 border-b border-border">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500/70" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
                <span className="ml-2 text-[11px] text-zinc-500 font-mono truncate">
                  strat-clone.app/{profile?.slug || 'your-slug'}
                </span>
              </div>

              <div className="max-h-[600px] overflow-y-auto">
                <ProfilePreview profile={profile} blocks={blocks} primaryColor={primaryColor} socialLinks={socialLinks} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProfilePreview({
  profile, blocks, primaryColor, socialLinks,
}: {
  profile: GatekeeperProfile | null;
  blocks: GatekeeperBlock[];
  primaryColor: string;
  socialLinks: Record<string, string>;
}) {
  const visibleBlocks = blocks.filter((b) => b.is_visible).sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="bg-white text-zinc-900">
      <div
        className="h-28 relative"
        style={{ background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}99)` }}
      >
        {profile?.cover_url && (
          <img src={profile.cover_url} alt="" className="w-full h-full object-cover" />
        )}
        <div className="absolute -bottom-8 left-5">
          {profile?.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt=""
              className="w-16 h-16 rounded-full border-4 border-white object-cover"
            />
          ) : (
            <div
              className="w-16 h-16 rounded-full border-4 border-white flex items-center justify-center text-white font-bold text-xl"
              style={{ background: primaryColor }}
            >
              {(profile?.display_name || 'T').charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      </div>

      <div className="pt-10 px-5 pb-5">
        <h1 className="text-xl font-bold">{profile?.display_name || 'Your Name'}</h1>
        <p className="text-sm" style={{ color: primaryColor }}>{profile?.tagline || 'Your tagline'}</p>

        {Object.keys(socialLinks).filter((k) => socialLinks[k]).length > 0 && (
          <div className="flex gap-2 mt-2">
            {Object.keys(socialLinks).filter((k) => socialLinks[k]).map((k) => (
              <span key={k} className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 capitalize">
                {k}
              </span>
            ))}
          </div>
        )}

        <div className="mt-4 space-y-4">
          {visibleBlocks.map((block) => (
            <PreviewBlock key={block.id} block={block} primaryColor={primaryColor} />
          ))}
        </div>
      </div>
    </div>
  );
}

function PreviewBlock({ block, primaryColor }: { block: GatekeeperBlock; primaryColor: string }) {
  switch (block.block_type) {
    case 'hero':
      return (
        <div className="rounded-lg p-4" style={{ background: `${primaryColor}15` }}>
          <h3 className="font-bold text-base mb-1">{block.title}</h3>
          <p className="text-sm text-zinc-600">{block.content}</p>
        </div>
      );
    case 'stats':
      return (
        <div>
          <h4 className="text-xs font-semibold uppercase text-zinc-400 mb-2">{block.title}</h4>
          <div className="grid grid-cols-3 gap-2">
            {['Win Rate', 'R/R', 'Trades'].map((label) => (
              <div key={label} className="bg-zinc-50 rounded-lg p-3 text-center">
                <p className="text-lg font-bold" style={{ color: primaryColor }}>—</p>
                <p className="text-[10px] text-zinc-500">{label}</p>
              </div>
            ))}
          </div>
          {block.content && <p className="text-xs text-zinc-500 mt-2">{block.content}</p>}
        </div>
      );
    case 'video':
    case 'trade_class':
      return (
        <div className="rounded-lg border border-zinc-200 overflow-hidden">
          {block.media_url ? (
            block.block_type === 'video' ? (
              <div className="aspect-video bg-zinc-900 flex items-center justify-center">
                <img src={block.media_url} alt="" className="w-full h-full object-cover" />
              </div>
            ) : (
              <img src={block.media_url} alt="" className="w-full h-32 object-cover" />
            )
          ) : (
            <div className="h-32 bg-zinc-100 flex items-center justify-center">
              <Video className="w-8 h-8 text-zinc-400" />
            </div>
          )}
          <div className="p-3">
            <h4 className="font-semibold text-sm">{block.title}</h4>
            <p className="text-xs text-zinc-500">{block.content}</p>
          </div>
        </div>
      );
    case 'image':
      return (
        <div className="rounded-lg overflow-hidden">
          {block.media_url ? (
            <img src={block.media_url} alt={block.title || ''} className="w-full" />
          ) : (
            <div className="h-32 bg-zinc-100 flex items-center justify-center">
              <Layout className="w-8 h-8 text-zinc-400" />
            </div>
          )}
          {block.title && <p className="text-xs text-zinc-500 mt-1">{block.title}</p>}
        </div>
      );
    case 'cta':
      return (
        <button
          className="w-full py-3 rounded-lg text-white font-medium text-sm"
          style={{ background: primaryColor }}
        >
          {block.title}
        </button>
      );
    default:
      return (
        <div>
          {block.title && <h4 className="font-semibold text-sm mb-1">{block.title}</h4>}
          <p className="text-sm text-zinc-600">{block.content}</p>
        </div>
      );
  }
}
