'use client';

import { useCallback, useEffect, useState } from 'react';
import { User, CreditCard, MessageSquare, Save, Loader as Loader2, Mail, Phone, Globe, Trash2, CircleCheck as CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { gatekeeper, GatekeeperProfile, GatekeeperSubscription, GatekeeperMessage } from '@/lib/api';

export default function ProfilePage() {
  const [profile, setProfile] = useState<GatekeeperProfile | null>(null);
  const [subscription, setSubscription] = useState<GatekeeperSubscription | null>(null);
  const [messages, setMessages] = useState<GatekeeperMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'billing' | 'feedback'>('profile');

  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [tagline, setTagline] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [socialLinks, setSocialLinks] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const [profileData, subData, msgData] = await Promise.all([
        gatekeeper.getProfile().catch(() => ({ profile: null, blocks: [] })),
        gatekeeper.getSubscription().catch(() => ({ subscription: null })),
        gatekeeper.getMessages().catch(() => ({ messages: [] })),
      ]);
      const p = profileData.profile as GatekeeperProfile | null;
      setProfile(p);
      setSubscription((subData as { subscription: GatekeeperSubscription }).subscription || null);
      setMessages((msgData as { messages: GatekeeperMessage[] }).messages || []);
      if (p) {
        setDisplayName(p.display_name || '');
        setBio(p.bio || '');
        setTagline(p.tagline || '');
        const links = typeof p.social_links === 'string' ? JSON.parse(p.social_links || '{}') : (p.social_links || {});
        setSocialLinks(links);
        setEmail(links.email || '');
        setWhatsapp(links.whatsapp || '');
      }
    } catch {
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    setSaving(true);
    try {
      const updatedLinks = { ...socialLinks, email, whatsapp };
      await gatekeeper.updateProfile({
        display_name: displayName,
        bio,
        tagline,
        social_links: updatedLinks,
      });
      toast.success('Profile saved — public website updated');
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  }

  async function handleSubscriptionChange(tier: GatekeeperSubscription['tier']) {
    try {
      const { subscription: sub } = await gatekeeper.updateSubscription(tier);
      setSubscription(sub);
      toast.success(`Subscription updated to ${tier}`);
    } catch {
      toast.error('Failed to update subscription');
    }
  }

  async function handleMarkRead(id: string) {
    try {
      await gatekeeper.markMessageRead(id);
      setMessages((prev) => prev.map((m) => m.id === id ? { ...m, is_read: true } : m));
    } catch {
      toast.error('Failed to mark message');
    }
  }

  async function handleDeleteMessage(id: string) {
    if (!confirm('Delete this message?')) return;
    try {
      await gatekeeper.deleteMessage(id);
      setMessages((prev) => prev.filter((m) => m.id !== id));
      toast.success('Message deleted');
    } catch {
      toast.error('Failed to delete message');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-zinc-600 animate-spin" />
      </div>
    );
  }

  const tabs = [
    { key: 'profile' as const, label: 'Profile', icon: User },
    { key: 'billing' as const, label: 'Billing', icon: CreditCard },
    { key: 'feedback' as const, label: 'Client Feedback', icon: MessageSquare },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1">Profile & Account</h1>
        <p className="text-zinc-400">Manage your public presence, billing, and client messages</p>
      </div>

      <div className="flex gap-2 mb-6 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all ${
              activeTab === tab.key
                ? 'border-accent-cyan text-accent-cyan'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {tab.key === 'feedback' && messages.filter((m) => !m.is_read).length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-red-500/20 text-red-400">
                {messages.filter((m) => !m.is_read).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {activeTab === 'profile' && (
        <div className="card max-w-2xl">
          <div className="flex items-center gap-3 mb-6">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.display_name || ''} className="w-16 h-16 rounded-full object-cover" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-accent-cyan/20 flex items-center justify-center text-2xl font-bold text-accent-cyan">
                {(displayName || 'T').charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-sm text-zinc-500">Public URL</p>
              <p className="font-medium text-accent-cyan">/{profile?.slug || 'your-username'}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="label">Display Name</label>
              <input className="input-field" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name or business" />
            </div>
            <div>
              <label className="label">Tagline</label>
              <input className="input-field" value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="Short professional tagline" />
            </div>
            <div>
              <label className="label">Bio</label>
              <textarea className="input-field min-h-[100px]" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Tell visitors about yourself..." />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label flex items-center gap-1"><Mail className="w-3 h-3" /> Email</label>
                <input className="input-field" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contact@example.com" />
              </div>
              <div>
                <label className="label flex items-center gap-1"><Phone className="w-3 h-3" /> WhatsApp</label>
                <input className="input-field" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="+1234567890" />
              </div>
            </div>
            <div>
              <label className="label flex items-center gap-1"><Globe className="w-3 h-3" /> Additional Social Links</label>
              <div className="space-y-2">
                {Object.entries(socialLinks).filter(([k]) => !['email', 'whatsapp'].includes(k)).map(([key, val]) => (
                  <div key={key} className="flex gap-2">
                    <input className="input-field flex-1" value={val} onChange={(e) => setSocialLinks({ ...socialLinks, [key]: e.target.value })} />
                    <button onClick={() => { const c = { ...socialLinks }; delete c[key]; setSocialLinks(c); }} className="text-zinc-500 hover:text-red-400 px-2">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => { const name = prompt('Link name (e.g. twitter, youtube):'); if (name) setSocialLinks({ ...socialLinks, [name.toLowerCase()]: '' }); }}
                  className="text-xs text-accent-cyan hover:underline"
                >
                  + Add link
                </button>
              </div>
            </div>
          </div>

          <button onClick={handleSave} disabled={saving} className="btn-primary mt-6 flex items-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      )}

      {activeTab === 'billing' && (
        <div className="space-y-6 max-w-2xl">
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Current Plan</h3>
            {subscription ? (
              <div className="flex items-center justify-between p-4 bg-zinc-900 rounded-lg">
                <div>
                  <p className="font-medium capitalize">{subscription.tier} Plan</p>
                  <p className="text-xs text-zinc-500">Status: {subscription.status}</p>
                </div>
                <p className="text-2xl font-bold mono-data">${(subscription.price_cents / 100).toFixed(2)}</p>
              </div>
            ) : (
              <p className="text-zinc-500 text-center py-8">No active subscription — choose a plan below</p>
            )}
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Available Plans</h3>
            <div className="grid sm:grid-cols-3 gap-3">
              {[
                { tier: 'free' as const, name: 'Free', price: 0, features: ['1 trading model', 'Basic dashboard', 'Public website'] },
                { tier: 'weekly' as const, name: 'Weekly', price: 999, features: ['Unlimited models', 'Live broker sync', 'AI Optimizer', 'Priority support'] },
                { tier: 'monthly' as const, name: 'Monthly', price: 2999, features: ['Everything in Weekly', 'Custom branding', 'Client billing', 'Advanced analytics'] },
              ].map((plan) => (
                <div
                  key={plan.tier}
                  className={`rounded-lg border p-4 ${subscription?.tier === plan.tier ? 'border-accent-cyan bg-accent-cyan/5' : 'border-border bg-zinc-900'}`}
                >
                  <p className="font-bold capitalize">{plan.name}</p>
                  <p className="text-2xl font-bold mono-data my-2">${(plan.price / 100).toFixed(2)}</p>
                  <ul className="space-y-1 mb-4">
                    {plan.features.map((f) => (
                      <li key={f} className="text-xs text-zinc-400 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3 text-emerald-400" /> {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => handleSubscriptionChange(plan.tier)}
                    disabled={subscription?.tier === plan.tier}
                    className={`w-full py-2 rounded-lg text-sm font-medium transition-all ${
                      subscription?.tier === plan.tier
                        ? 'bg-zinc-800 text-zinc-500 cursor-default'
                        : 'btn-primary'
                    }`}
                  >
                    {subscription?.tier === plan.tier ? 'Current Plan' : 'Select'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'feedback' && (
        <div className="card max-w-2xl">
          <h3 className="text-lg font-semibold mb-4">Client Messages & Feedback</h3>
          {messages.length === 0 ? (
            <p className="text-zinc-500 text-center py-8">No messages yet. Messages from your public website contact form will appear here.</p>
          ) : (
            <div className="space-y-3">
              {messages.map((msg) => (
                <div key={msg.id} className={`p-4 rounded-lg border ${msg.is_read ? 'border-border bg-zinc-900/50' : 'border-accent-cyan/30 bg-accent-cyan/5'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-medium text-sm">{msg.sender_name}</p>
                      <p className="text-xs text-zinc-500">{msg.sender_email} · {msg.page} · {new Date(msg.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {!msg.is_read && <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent-cyan/20 text-accent-cyan">New</span>}
                      {!msg.is_read && (
                        <button onClick={() => handleMarkRead(msg.id)} className="text-xs text-zinc-400 hover:text-emerald-400">Mark read</button>
                      )}
                      <button onClick={() => handleDeleteMessage(msg.id)} className="text-zinc-500 hover:text-red-400">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-zinc-300">{msg.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
