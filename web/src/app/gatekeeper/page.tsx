'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Globe, Plus, Trash2, Eye, EyeOff, Loader2, GripVertical,
  Sparkles, Palette, LayoutGrid as Layout, Video, Type, BarChart3,
  Megaphone, CreditCard, Check, ExternalLink, LogOut, Clock, Ban,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  gatekeeper, GatekeeperProfile, GatekeeperBlock, GatekeeperSubscription, GatekeeperApprovalState,
} from '@/lib/api';
import { useAuthGuard, getUser, logout } from '@/lib/auth';

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
  const [approval, setApproval] = useState<GatekeeperApprovalState | null>(null);
  const [loading, setLoading] = useState(true);
  const [socialLinks, setSocialLinks] = useState<Record<string, string>>({});
  const [showAddKit, setShowAddKit] = useState(false);

  const load = useCallback(async () => {
    try {
      const [pData, sData, aData] = await Promise.all([
        gatekeeper.getProfile(),
        gatekeeper.getSubscription(),
        gatekeeper.getStatus(),
      ]);
      setProfile(pData.profile);
      setBlocks(pData.blocks || []);
      setSocialLinks(parseJson(pData.profile.social_links, {}));
      setSubscription(sData.subscription);
      setApproval(aData);
    } catch {
      toast.error('Failed to load your Gatekeeper profile');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const theme = profile ? parseJson(profile.theme, { primary_color: '#10b981' }) : { primary_color: '#10b981' };
  const primaryColor = theme.primary_color || '#10b981';

  // Auto-save a single profile field on blur — no Save button needed.
  const saveProfileField = useCallback(async (patch: Partial<GatekeeperProfile>) => {
    try {
      const { profile: updated } = await gatekeeper.updateProfile({
        ...patch,
        social_links: socialLinks,
        theme: { ...theme, ...(patch as { theme?: typeof theme }).theme },
      });
      setProfile(updated);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Auto-save failed');
      load();
    }
  }, [socialLinks, theme, load]);

  const saveBlockField = useCallback(async (id: string, patch: Partial<GatekeeperBlock>) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
    try {
      await gatekeeper.updateBlock(id, patch);
    } catch {
      toast.error('Auto-save failed');
      load();
    }
  }, [load]);

  async function handleAddBlock(blockType: string) {
    try {
      const { block } = await gatekeeper.addBlock({
        block_type: blockType, title: 'New block', content: '', sort_order: blocks.length,
      });
      setBlocks([...blocks, block]);
      setShowAddKit(false);
      toast.success('Block added');
    } catch {
      toast.error('Failed to add block');
    }
  }

  async function handleDeleteBlock(id: string) {
    try {
      await gatekeeper.deleteBlock(id);
      setBlocks(blocks.filter((b) => b.id !== id));
      toast.success('Block deleted');
    } catch {
      toast.error('Failed to delete block');
    }
  }

  async function handlePublish(value: boolean) {
    await saveProfileField({ is_published: value });
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

  // Approval gating — pending/revoked users see a status screen, not the editor.
  if (approval && approval.approvalStatus === 'pending') {
    return <ApprovalScreen icon={Clock} title="Awaiting Approval" message="Your account is pending review. You'll be able to edit your site once approved." email={approval.email} />;
  }
  if (approval && approval.approvalStatus === 'revoked') {
    return <ApprovalScreen icon={Ban} title="Access Revoked" message="Your editing access has been revoked. Contact support if you believe this is an error." email={approval.email} />;
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header profile={profile} onPublish={handlePublish} email={user?.email} />

      <div className="max-w-7xl mx-auto px-6 py-8 grid lg:grid-cols-2 gap-8 items-start">
        {/* LEFT: settings panel */}
        <div className="space-y-6">
          <SettingsPanel
            profile={profile}
            onProfileChange={setProfile}
            socialLinks={socialLinks}
            setSocialLinks={setSocialLinks}
            primaryColor={primaryColor}
            theme={theme}
            saveProfileField={saveProfileField}
          />

          <BlocksPanel
            blocks={blocks}
            onAdd={() => setShowAddKit(true)}
            onDelete={handleDeleteBlock}
            onUpdate={saveBlockField}
          />

          <MonetizationPanel subscription={subscription} onTierChange={handleTierChange} />
        </div>

        {/* RIGHT: live click-to-edit preview */}
        <div className="lg:sticky lg:top-20">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Eye className="w-5 h-5 text-accent-green" /> Live Preview
              </h2>
              <span className="text-xs text-zinc-500 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Click any text to edit
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
                <EditablePreview
                  profile={profile}
                  blocks={blocks}
                  primaryColor={primaryColor}
                  socialLinks={socialLinks}
                  saveProfileField={saveProfileField}
                  saveBlockField={saveBlockField}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating admin toolbar */}
      <FloatingToolbar
        onAddKit={() => setShowAddKit((v) => !v)}
        published={profile?.is_published || false}
        onTogglePublish={() => handlePublish(!profile?.is_published)}
        onSignOut={() => { logout(); }}
      />

      {/* Add Kit sidebar */}
      {showAddKit && (
        <AddKitSidebar
          onClose={() => setShowAddKit(false)}
          onAdd={handleAddBlock}
        />
      )}
    </div>
  );
}

// ─── Inline editable text primitive ───
function EditableText({
  value, onSave, className, style, placeholder, multiline,
}: {
  value: string;
  onSave: (v: string) => void;
  className?: string;
  style?: React.CSSProperties;
  placeholder?: string;
  multiline?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  const [editing, setEditing] = useState(false);

  function startEdit(e: React.MouseEvent) {
    e.stopPropagation();
    setEditing(true);
  }

  function commit() {
    setEditing(false);
    const text = ref.current?.innerText?.trim() || '';
    if (text !== value) onSave(text);
  }

  if (editing) {
    const Tag = multiline ? 'div' : 'span';
    return (
      <Tag
        ref={ref as React.RefObject<any>}
        contentEditable
        suppressContentEditableWarning
        autoFocus
        onBlur={commit}
        onKeyDown={(e) => {
          if (!multiline && e.key === 'Enter') { e.preventDefault(); (e.target as HTMLElement).blur(); }
          if (e.key === 'Escape') { setEditing(false); if (ref.current) ref.current.innerText = value; }
        }}
        className={`${className} outline-none ring-2 ring-accent-cyan/60 rounded px-1 -mx-1`}
        style={style}
        dangerouslySetInnerHTML={{ __html: value || placeholder || '' }}
      />
    );
  }

  const Tag = multiline ? 'p' : 'span';
  return (
    <Tag
      className={`${className} cursor-text hover:bg-accent-cyan/10 hover:ring-1 hover:ring-accent-cyan/40 rounded px-1 -mx-1 transition-all`}
      style={style}
      onClick={startEdit}
      title="Click to edit"
    >
      {value || <span className="text-zinc-400 italic">{placeholder || 'Click to edit'}</span>}
    </Tag>
  );
}

// ─── Header ───
function Header({ profile, onPublish, email }: { profile: GatekeeperProfile | null; onPublish: (v: boolean) => void; email?: string }) {
  const router = useRouter();
  return (
    <header className="border-b border-border bg-surface/80 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/dashboard')} className="text-zinc-400 hover:text-white text-sm">← Dashboard</button>
          <span className="text-zinc-600">/</span>
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-accent-green" />
            <span className="font-bold">Gatekeeper CMS</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {profile?.is_published ? (
            <button onClick={() => onPublish(false)} className="flex items-center gap-1.5 text-sm text-amber-400 hover:text-amber-300">
              <EyeOff className="w-4 h-4" /> Unpublish
            </button>
          ) : (
            <button onClick={() => onPublish(true)} className="flex items-center gap-1.5 text-sm text-emerald-400 hover:text-emerald-300">
              <Eye className="w-4 h-4" /> Publish
            </button>
          )}
          {email && <span className="text-sm text-zinc-400 hidden sm:block">{email}</span>}
        </div>
      </div>
    </header>
  );
}

// ─── Settings panel ───
function SettingsPanel({
  profile, onProfileChange, socialLinks, setSocialLinks, primaryColor, theme, saveProfileField,
}: {
  profile: GatekeeperProfile | null;
  onProfileChange: (p: GatekeeperProfile) => void;
  socialLinks: Record<string, string>;
  setSocialLinks: (v: Record<string, string>) => void;
  primaryColor: string;
  theme: { primary_color?: string };
  saveProfileField: (patch: Partial<GatekeeperProfile>) => void;
}) {
  if (!profile) return null;
  return (
    <div className="card">
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Palette className="w-5 h-5 text-accent-cyan" /> Profile Settings
      </h2>
      <div className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Display Name</label>
            <input className="input-field" defaultValue={profile.display_name || ''}
              onChange={(e) => onProfileChange({ ...profile, display_name: e.target.value })}
              onBlur={(e) => saveProfileField({ display_name: e.target.value })} />
          </div>
          <div>
            <label className="label">URL Slug</label>
            <input className="input-field mono-data" defaultValue={profile.slug || ''}
              onChange={(e) => onProfileChange({ ...profile, slug: e.target.value })}
              onBlur={(e) => saveProfileField({ slug: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="label">Tagline</label>
          <input className="input-field" defaultValue={profile.tagline || ''}
            onChange={(e) => onProfileChange({ ...profile, tagline: e.target.value })}
            onBlur={(e) => saveProfileField({ tagline: e.target.value })} placeholder="Sharing my edge with the world" />
        </div>
        <div>
          <label className="label">Bio</label>
          <textarea className="input-field min-h-24" defaultValue={profile.bio || ''}
            onChange={(e) => onProfileChange({ ...profile, bio: e.target.value })}
            onBlur={(e) => saveProfileField({ bio: e.target.value })} placeholder="Tell visitors about your trading journey…" />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Avatar URL</label>
            <input className="input-field" defaultValue={profile.avatar_url || ''}
              onChange={(e) => onProfileChange({ ...profile, avatar_url: e.target.value })}
              onBlur={(e) => saveProfileField({ avatar_url: e.target.value })} placeholder="https://…" />
          </div>
          <div>
            <label className="label">Cover Image URL</label>
            <input className="input-field" defaultValue={profile.cover_url || ''}
              onChange={(e) => onProfileChange({ ...profile, cover_url: e.target.value })}
              onBlur={(e) => saveProfileField({ cover_url: e.target.value })} placeholder="https://…" />
          </div>
        </div>
        <div>
          <label className="label">Accent Color</label>
          <div className="flex gap-2">
            {COLOR_SWATCHES.map((c) => (
              <button key={c} onClick={() => saveProfileField({ theme: { ...theme, primary_color: c } } as Partial<GatekeeperProfile>)}
                className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${primaryColor === c ? 'border-white' : 'border-transparent'}`}
                style={{ background: c }} aria-label={`Accent ${c}`} />
            ))}
          </div>
        </div>
        <div>
          <label className="label">Social Links</label>
          <div className="grid grid-cols-2 gap-2">
            {['twitter', 'youtube', 'discord', 'telegram'].map((key) => (
              <input key={key} className="input-field text-sm" placeholder={`${key} URL`}
                value={socialLinks[key] || ''}
                onChange={(e) => setSocialLinks({ ...socialLinks, [key]: e.target.value })}
                onBlur={() => saveProfileField({})} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Blocks panel ───
function BlocksPanel({
  blocks, onAdd, onDelete, onUpdate,
}: {
  blocks: GatekeeperBlock[];
  onAdd: () => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, patch: Partial<GatekeeperBlock>) => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  return (
    <div className="card">
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Layout className="w-5 h-5 text-accent-cyan" /> Page Blocks
      </h2>
      <button onClick={onAdd} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-cyan/10 border border-accent-cyan/30 text-xs text-accent-cyan mb-4 hover:bg-accent-cyan/20 transition-all">
        <Plus className="w-3.5 h-3.5" /> Add Block
      </button>
      <div className="space-y-2">
        {blocks.length === 0 ? (
          <p className="text-zinc-500 text-center py-6 text-sm">No blocks yet — add one to build your page.</p>
        ) : blocks.map((block) => (
          <div key={block.id}
            className={`rounded-lg border p-3 cursor-pointer transition-all ${activeId === block.id ? 'border-accent-cyan/50 bg-accent-cyan/5' : 'border-border bg-zinc-900/50 hover:bg-zinc-900'}`}
            onClick={() => setActiveId(activeId === block.id ? null : block.id)}>
            <div className="flex items-center gap-2 mb-1">
              <GripVertical className="w-3.5 h-3.5 text-zinc-600" />
              <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 capitalize">{block.block_type}</span>
              <span className="text-sm font-medium flex-1 truncate">{block.title || 'Untitled'}</span>
              <button onClick={(e) => { e.stopPropagation(); onDelete(block.id); }} className="text-zinc-500 hover:text-red-400 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            {activeId === block.id && (
              <div className="mt-3 space-y-3" onClick={(e) => e.stopPropagation()}>
                <div>
                  <label className="label">Title</label>
                  <input className="input-field text-sm" defaultValue={block.title || ''}
                    onChange={(e) => onUpdate(block.id, { title: e.target.value })} />
                </div>
                <div>
                  <label className="label">Content</label>
                  <textarea className="input-field text-sm min-h-16" defaultValue={block.content || ''}
                    onChange={(e) => onUpdate(block.id, { content: e.target.value })} />
                </div>
                {(block.block_type === 'image' || block.block_type === 'video' || block.block_type === 'trade_class') && (
                  <div>
                    <label className="label">Media URL</label>
                    <input className="input-field text-sm" defaultValue={block.media_url || ''}
                      onChange={(e) => onUpdate(block.id, { media_url: e.target.value })} placeholder="https://… (image or video URL)" />
                  </div>
                )}
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm text-zinc-300">
                    <input type="number" className="input-field w-20 text-sm" defaultValue={block.sort_order}
                      onChange={(e) => onUpdate(block.id, { sort_order: Number(e.target.value) })} /> Order
                  </label>
                  <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
                    <input type="checkbox" checked={block.is_visible}
                      onChange={(e) => onUpdate(block.id, { is_visible: e.target.checked })} className="accent-accent-cyan" /> Visible
                  </label>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Monetization ───
function MonetizationPanel({ subscription, onTierChange }: { subscription: GatekeeperSubscription | null; onTierChange: (t: GatekeeperSubscription['tier']) => void }) {
  return (
    <div className="card">
      <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
        <CreditCard className="w-5 h-5 text-accent-cyan" /> Subscription Plan
      </h2>
      <p className="text-sm text-zinc-400 mb-4">Everything is free during testing. Pick a tier to prepare for launch.</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {TIERS.map((t) => {
          const active = subscription?.tier === t.tier;
          return (
            <button key={t.tier} onClick={() => onTierChange(t.tier)}
              className={`relative rounded-lg border p-3 text-left transition-all ${active ? 'border-accent-cyan bg-accent-cyan/10' : 'border-border bg-zinc-900/50 hover:bg-zinc-900'}`}>
              {active && <Check className="absolute top-2 right-2 w-4 h-4 text-accent-cyan" />}
              <p className="font-semibold text-sm">{t.label}</p>
              <p className="text-xs text-zinc-400 mt-1"><span className="mono-data">{t.price}</span> {t.period}</p>
              <p className="text-[10px] text-zinc-500 mt-1">{t.desc}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Editable live preview (click-to-edit) ───
function EditablePreview({
  profile, blocks, primaryColor, socialLinks, saveProfileField, saveBlockField,
}: {
  profile: GatekeeperProfile | null;
  blocks: GatekeeperBlock[];
  primaryColor: string;
  socialLinks: Record<string, string>;
  saveProfileField: (patch: Partial<GatekeeperProfile>) => void;
  saveBlockField: (id: string, patch: Partial<GatekeeperBlock>) => void;
}) {
  const visibleBlocks = blocks.filter((b) => b.is_visible).sort((a, b) => a.sort_order - b.sort_order);
  return (
    <div className="bg-white text-zinc-900">
      <div className="h-28 relative" style={{ background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}99)` }}>
        {profile?.cover_url && <img src={profile.cover_url} alt="" className="w-full h-full object-cover" />}
        <div className="absolute -bottom-8 left-5">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="w-16 h-16 rounded-full border-4 border-white object-cover" />
          ) : (
            <div className="w-16 h-16 rounded-full border-4 border-white flex items-center justify-center text-white font-bold text-xl" style={{ background: primaryColor }}>
              {(profile?.display_name || 'T').charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      </div>
      <div className="pt-10 px-5 pb-5">
        <h1 className="text-xl font-bold">
          <EditableText value={profile?.display_name || ''} onSave={(v) => saveProfileField({ display_name: v })} placeholder="Your Name" />
        </h1>
        <p className="text-sm" style={{ color: primaryColor }}>
          <EditableText value={profile?.tagline || ''} onSave={(v) => saveProfileField({ tagline: v })} placeholder="Your tagline" />
        </p>
        {Object.keys(socialLinks).filter((k) => socialLinks[k]).length > 0 && (
          <div className="flex gap-2 mt-2">
            {Object.keys(socialLinks).filter((k) => socialLinks[k]).map((k) => (
              <span key={k} className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 capitalize">{k}</span>
            ))}
          </div>
        )}
        <div className="mt-4 space-y-4">
          {visibleBlocks.map((block) => (
            <EditablePreviewBlock key={block.id} block={block} primaryColor={primaryColor} onSave={saveBlockField} />
          ))}
        </div>
      </div>
    </div>
  );
}

function EditablePreviewBlock({
  block, primaryColor, onSave,
}: {
  block: GatekeeperBlock;
  primaryColor: string;
  onSave: (id: string, patch: Partial<GatekeeperBlock>) => void;
}) {
  switch (block.block_type) {
    case 'hero':
      return (
        <div className="rounded-lg p-4" style={{ background: `${primaryColor}15` }}>
          <h3 className="font-bold text-base mb-1">
            <EditableText value={block.title || ''} onSave={(v) => onSave(block.id, { title: v })} placeholder="Hero title" />
          </h3>
          <p className="text-sm text-zinc-600">
            <EditableText value={block.content || ''} onSave={(v) => onSave(block.id, { content: v })} placeholder="Hero subtitle" multiline />
          </p>
        </div>
      );
    case 'stats':
      return (
        <div>
          <h4 className="text-xs font-semibold uppercase text-zinc-400 mb-2">
            <EditableText value={block.title || ''} onSave={(v) => onSave(block.id, { title: v })} placeholder="Stats title" />
          </h4>
          <div className="grid grid-cols-3 gap-2">
            {['Win Rate', 'R/R', 'Trades'].map((label) => (
              <div key={label} className="bg-zinc-50 rounded-lg p-3 text-center">
                <p className="text-lg font-bold" style={{ color: primaryColor }}>—</p>
                <p className="text-[10px] text-zinc-500">{label}</p>
              </div>
            ))}
          </div>
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
            <div className="h-32 bg-zinc-100 flex items-center justify-center"><Video className="w-8 h-8 text-zinc-400" /></div>
          )}
          <div className="p-3">
            <h4 className="font-semibold text-sm">
              <EditableText value={block.title || ''} onSave={(v) => onSave(block.id, { title: v })} placeholder="Title" />
            </h4>
            <p className="text-xs text-zinc-500">
              <EditableText value={block.content || ''} onSave={(v) => onSave(block.id, { content: v })} placeholder="Description" multiline />
            </p>
          </div>
        </div>
      );
    case 'image':
      return (
        <div className="rounded-lg overflow-hidden">
          {block.media_url ? (
            <img src={block.media_url} alt={block.title || ''} className="w-full" />
          ) : (
            <div className="h-32 bg-zinc-100 flex items-center justify-center"><Layout className="w-8 h-8 text-zinc-400" /></div>
          )}
          {block.title && <p className="text-xs text-zinc-500 mt-1">{block.title}</p>}
        </div>
      );
    case 'cta':
      return (
        <button className="w-full py-3 rounded-lg text-white font-medium text-sm" style={{ background: primaryColor }}>
          <EditableText value={block.title || ''} onSave={(v) => onSave(block.id, { title: v })} placeholder="Call to action" />
        </button>
      );
    default:
      return (
        <div>
          <h4 className="font-semibold text-sm mb-1">
            <EditableText value={block.title || ''} onSave={(v) => onSave(block.id, { title: v })} placeholder="Title" />
          </h4>
          <p className="text-sm text-zinc-600">
            <EditableText value={block.content || ''} onSave={(v) => onSave(block.id, { content: v })} placeholder="Content" multiline />
          </p>
        </div>
      );
  }
}

// ─── Floating admin toolbar ───
function FloatingToolbar({
  onAddKit, published, onTogglePublish, onSignOut,
}: {
  onAddKit: () => void;
  published: boolean;
  onTogglePublish: () => void;
  onSignOut: () => void;
}) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 px-3 py-2 rounded-full bg-surface border border-border shadow-lg shadow-black/30 backdrop-blur-md">
      <button onClick={onAddKit} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs text-zinc-300 hover:bg-accent-cyan/10 hover:text-accent-cyan transition-all">
        <Plus className="w-4 h-4" /> Add Kit
      </button>
      <button onClick={onTogglePublish} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-all ${published ? 'text-amber-400 hover:bg-amber-500/10' : 'text-emerald-400 hover:bg-emerald-500/10'}`}>
        {published ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />} {published ? 'Unpublish' : 'Publish'}
      </button>
      <a href="/dashboard" target="_blank" className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs text-zinc-300 hover:bg-accent-cyan/10 hover:text-accent-cyan transition-all">
        <ExternalLink className="w-4 h-4" /> Dashboard
      </a>
      <button onClick={onSignOut} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs text-zinc-300 hover:bg-red-500/10 hover:text-red-400 transition-all">
        <LogOut className="w-4 h-4" /> Exit
      </button>
    </div>
  );
}

// ─── Add Kit sidebar ───
function AddKitSidebar({ onClose, onAdd }: { onClose: () => void; onAdd: (type: string) => void }) {
  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 z-50 w-72 bg-surface border-l border-border p-5 overflow-y-auto animate-in slide-in-from-right">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold flex items-center gap-2"><Sparkles className="w-4 h-4 text-accent-cyan" /> Add Block</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-white text-sm">Close</button>
        </div>
        <div className="space-y-2">
          {BLOCK_TYPES.map((bt) => (
            <button key={bt.type} onClick={() => onAdd(bt.type)}
              className="w-full flex items-center gap-3 p-3 rounded-lg bg-zinc-900 border border-border hover:border-accent-cyan/50 hover:bg-accent-cyan/5 transition-all text-left">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-accent-cyan/10">
                <bt.icon className="w-4 h-4 text-accent-cyan" />
              </div>
              <div>
                <p className="text-sm font-medium">{bt.label}</p>
                <p className="text-[10px] text-zinc-500 capitalize">{bt.type.replace('_', ' ')} block</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

// ─── Approval screen ───
function ApprovalScreen({ icon: Icon, title, message, email }: { icon: React.ComponentType<{ className?: string }>; title: string; message: string; email: string }) {
  const router = useRouter();
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-5">
          <Icon className="w-8 h-8 text-amber-400" />
        </div>
        <h1 className="text-xl font-bold mb-2">{title}</h1>
        <p className="text-sm text-zinc-400 mb-4">{message}</p>
        <p className="text-xs text-zinc-500 mb-6">Signed in as <span className="mono-data text-zinc-300">{email}</span></p>
        <button onClick={() => router.push('/dashboard')} className="btn-primary">Back to Dashboard</button>
      </div>
    </div>
  );
}
