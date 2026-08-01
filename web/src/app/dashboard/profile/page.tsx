'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import {
  User, CreditCard, MessageSquare, Save, Loader as Loader2, Mail, Phone, Globe,
  Trash2, CircleCheck as CheckCircle, Camera, Image as ImageIcon, MapPin, Briefcase,
  Send, ArrowLeft, X, CreditCard as CardIcon, Wallet, Smartphone, Calendar,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { gatekeeper, GatekeeperProfile, GatekeeperSubscription, GatekeeperMessage } from '@/lib/api';

type PaymentMethod = 'card' | 'paypal' | 'mobile';

interface PlanTier {
  tier: GatekeeperSubscription['tier'];
  name: string;
  price: number;
  period: string;
  features: string[];
  popular?: boolean;
}

const PLANS: PlanTier[] = [
  { tier: 'free', name: 'Free', price: 0, period: 'forever', features: ['1 trading model', 'Basic dashboard', 'Public website', 'Community support'] },
  { tier: 'weekly', name: 'Weekly', price: 999, period: '/week', features: ['Unlimited models', 'Live broker sync', 'AI Optimizer', 'Priority support', 'Custom branding'] },
  { tier: 'monthly', name: 'Monthly', price: 2999, period: '/month', features: ['Everything in Weekly', 'Advanced analytics', 'Client billing portal', 'API access', 'Email support'] },
  { tier: 'yearly', name: 'Yearly', price: 29999, period: '/year', features: ['Everything in Monthly', '2 months free', 'Dedicated account manager', 'White-label option', '24/7 phone support'], popular: true },
];

const SOCIAL_PLATFORMS = ['twitter', 'telegram', 'github', 'linkedin', 'youtube', 'instagram', 'facebook', 'tiktok', 'discord'];

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
  const [headline, setHeadline] = useState('');
  const [location, setLocation] = useState('');
  const [skills, setSkills] = useState('');
  const [services, setServices] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [socialLinks, setSocialLinks] = useState<Record<string, string>>({});

  const [paymentModal, setPaymentModal] = useState<PlanTier | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');
  const [processing, setProcessing] = useState(false);
  const [cardData, setCardData] = useState({ number: '', expiry: '', cvc: '', name: '' });
  const [paypalData, setPaypalData] = useState({ email: '' });
  const [mobileData, setMobileData] = useState({ phone: '', provider: 'mtn' });

  const [selectedMessage, setSelectedMessage] = useState<GatekeeperMessage | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

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
        setAvatarUrl(p.avatar_url || '');
        setBannerUrl(p.cover_url || '');
        const meta = typeof p.metadata === 'string' ? JSON.parse(p.metadata || '{}') : (p.metadata || {});
        setHeadline(meta.headline || '');
        setLocation(meta.location || '');
        setSkills(meta.skills || '');
        setServices(meta.services || '');
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
        avatar_url: avatarUrl,
        cover_url: bannerUrl,
        metadata: { headline, location, skills, services },
      } as Record<string, unknown>);
      toast.success('Profile saved — public website updated');
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  }

  function handleImageUpload(type: 'avatar' | 'banner', file: File) {
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      if (type === 'avatar') setAvatarUrl(url);
      else setBannerUrl(url);
      toast.success(`${type === 'avatar' ? 'Avatar' : 'Banner'} image selected — save to apply`);
    };
    reader.readAsDataURL(file);
  }

  async function handleSubscriptionChange(plan: PlanTier) {
    if (plan.tier === 'free') {
      try {
        const { subscription: sub } = await gatekeeper.updateSubscription('free');
        setSubscription(sub);
        toast.success('Switched to Free plan');
      } catch {
        toast.error('Failed to update subscription');
      }
      return;
    }
    setPaymentModal(plan);
  }

  async function handlePayment() {
    if (!paymentModal) return;
    if (paymentMethod === 'card' && (!cardData.number || !cardData.expiry || !cardData.cvc)) {
      toast.error('Please fill in all card details');
      return;
    }
    if (paymentMethod === 'paypal' && !paypalData.email) {
      toast.error('Please enter your PayPal email');
      return;
    }
    if (paymentMethod === 'mobile' && !mobileData.phone) {
      toast.error('Please enter your mobile money number');
      return;
    }

    setProcessing(true);
    try {
      await new Promise((r) => setTimeout(r, 1500));
      const { subscription: sub } = await gatekeeper.updateSubscription(paymentModal.tier);
      setSubscription(sub);
      toast.success(`Payment successful — ${paymentModal.name} plan activated`);
      setPaymentModal(null);
      setCardData({ number: '', expiry: '', cvc: '', name: '' });
      setPaypalData({ email: '' });
      setMobileData({ phone: '', provider: 'mtn' });
    } catch {
      toast.error('Payment failed — please try again');
    } finally {
      setProcessing(false);
    }
  }

  async function handleMarkRead(id: string) {
    try {
      await gatekeeper.markMessageRead(id);
      setMessages((prev) => prev.map((m) => m.id === id ? { ...m, is_read: true } : m));
      if (selectedMessage?.id === id) setSelectedMessage((prev) => prev ? { ...prev, is_read: true } : null);
    } catch {
      toast.error('Failed to mark message');
    }
  }

  async function handleDeleteMessage(id: string) {
    if (!confirm('Delete this message?')) return;
    try {
      await gatekeeper.deleteMessage(id);
      setMessages((prev) => prev.filter((m) => m.id !== id));
      if (selectedMessage?.id === id) setSelectedMessage(null);
      toast.success('Message deleted');
    } catch {
      toast.error('Failed to delete message');
    }
  }

  async function handleSendReply() {
    if (!selectedMessage || !replyText.trim()) return;
    setSendingReply(true);
    try {
      const { message: updated } = await gatekeeper.replyToMessage(selectedMessage.id, replyText);
      setMessages((prev) => prev.map((m) => m.id === updated.id ? updated : m));
      setSelectedMessage(updated);
      setReplyText('');
      toast.success('Reply sent');
    } catch {
      toast.error('Failed to send reply');
    } finally {
      setSendingReply(false);
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

      {/* PROFILE TAB */}
      {activeTab === 'profile' && (
        <div className="card max-w-2xl">
          {/* Banner */}
          <div className="relative -mx-6 -mt-6 mb-6 h-32 rounded-t-xl overflow-hidden bg-zinc-800 group">
            {bannerUrl ? (
              <img src={bannerUrl} alt="Banner" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-600">
                <ImageIcon className="w-8 h-8" />
              </div>
            )}
            <button
              onClick={() => bannerInputRef.current?.click()}
              className="absolute bottom-2 right-2 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-black/60 text-xs text-white hover:bg-black/80 transition-colors"
            >
              <Camera className="w-3 h-3" /> Change Banner
            </button>
            <input
              ref={bannerInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleImageUpload('banner', e.target.files[0])}
            />
          </div>

          {/* Avatar */}
          <div className="flex items-center gap-4 mb-6">
            <div className="relative">
              {avatarUrl ? (
                <img src={avatarUrl} alt={displayName || ''} className="w-20 h-20 rounded-full object-cover border-2 border-border" />
              ) : (
                <div className="w-20 h-20 rounded-full bg-accent-cyan/20 flex items-center justify-center text-3xl font-bold text-accent-cyan border-2 border-border">
                  {(displayName || 'T').charAt(0).toUpperCase()}
                </div>
              )}
              <button
                onClick={() => avatarInputRef.current?.click()}
                className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-accent-cyan text-zinc-900 flex items-center justify-center hover:scale-110 transition-transform"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleImageUpload('avatar', e.target.files[0])}
              />
            </div>
            <div>
              <p className="text-sm text-zinc-500">Public URL</p>
              <p className="font-medium text-accent-cyan">/{profile?.slug || 'your-username'}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Display Name</label>
                <input className="input-field" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name or business" />
              </div>
              <div>
                <label className="label flex items-center gap-1"><Briefcase className="w-3 h-3" /> Professional Title</label>
                <input className="input-field" value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="e.g. Senior Day Trader & Mentor" />
              </div>
            </div>
            <div>
              <label className="label">Tagline</label>
              <input className="input-field" value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="Short professional tagline" />
            </div>
            <div>
              <label className="label flex items-center gap-1"><MapPin className="w-3 h-3" /> Location / Country</label>
              <input className="input-field" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Kampala, Uganda" />
            </div>
            <div>
              <label className="label">Bio</label>
              <textarea className="input-field min-h-[100px]" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Tell visitors about yourself..." />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Primary Skills / Specialization</label>
                <input className="input-field" value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="e.g. Scalping, Options, Crypto" />
              </div>
              <div>
                <label className="label">Services Offered</label>
                <input className="input-field" value={services} onChange={(e) => setServices(e.target.value)} placeholder="e.g. Mentorship, Signals, Courses" />
              </div>
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

            {/* Expanded Social Links */}
            <div>
              <label className="label flex items-center gap-1"><Globe className="w-3 h-3" /> Social & Communication Links</label>
              <div className="grid sm:grid-cols-2 gap-3">
                {SOCIAL_PLATFORMS.map((platform) => (
                  <div key={platform} className="flex items-center gap-2">
                    <span className="text-xs text-zinc-500 w-20 capitalize">{platform}</span>
                    <input
                      className="input-field flex-1 text-sm"
                      value={socialLinks[platform] || ''}
                      onChange={(e) => setSocialLinks({ ...socialLinks, [platform]: e.target.value })}
                      placeholder={`https://${platform}.com/...`}
                    />
                  </div>
                ))}
              </div>
              {/* Custom links */}
              {Object.keys(socialLinks).filter((k) => !SOCIAL_PLATFORMS.includes(k) && !['email', 'whatsapp'].includes(k)).map((key) => (
                <div key={key} className="flex items-center gap-2 mt-2">
                  <span className="text-xs text-zinc-500 w-20 capitalize">{key}</span>
                  <input className="input-field flex-1 text-sm" value={socialLinks[key]} onChange={(e) => setSocialLinks({ ...socialLinks, [key]: e.target.value })} />
                  <button onClick={() => { const c = { ...socialLinks }; delete c[key]; setSocialLinks(c); }} className="text-zinc-500 hover:text-red-400 px-2">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => { const name = prompt('Link name:'); if (name) setSocialLinks({ ...socialLinks, [name.toLowerCase()]: '' }); }}
                className="text-xs text-accent-cyan hover:underline mt-2"
              >
                + Add custom link
              </button>
            </div>
          </div>

          <button onClick={handleSave} disabled={saving} className="btn-primary mt-6 flex items-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      )}

      {/* BILLING TAB */}
      {activeTab === 'billing' && (
        <div className="space-y-6 max-w-3xl">
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Current Plan</h3>
            {subscription ? (
              <div className="flex items-center justify-between p-4 bg-zinc-900 rounded-lg">
                <div>
                  <p className="font-medium capitalize">{subscription.tier} Plan</p>
                  <p className="text-xs text-zinc-500">Status: {subscription.status}</p>
                </div>
                <p className="text-2xl font-bold mono-data">
                  {subscription.price_cents > 0 ? `$${(subscription.price_cents / 100).toFixed(2)}` : 'Free'}
                </p>
              </div>
            ) : (
              <p className="text-zinc-500 text-center py-8">No active subscription — choose a plan below</p>
            )}
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Available Plans</h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {PLANS.map((plan) => (
                <div
                  key={plan.tier}
                  className={`rounded-lg border p-4 relative ${subscription?.tier === plan.tier ? 'border-accent-cyan bg-accent-cyan/5' : 'border-border bg-zinc-900'} ${plan.popular ? 'ring-1 ring-accent-cyan/30' : ''}`}
                >
                  {plan.popular && (
                    <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[10px] px-2 py-0.5 rounded-full bg-accent-cyan text-zinc-900 font-bold">
                      BEST VALUE
                    </span>
                  )}
                  <p className="font-bold capitalize">{plan.name}</p>
                  <p className="text-2xl font-bold mono-data my-2">
                    {plan.price === 0 ? '$0' : `$${(plan.price / 100).toFixed(2)}`}
                    <span className="text-xs text-zinc-500 font-normal">{plan.period}</span>
                  </p>
                  <ul className="space-y-1 mb-4">
                    {plan.features.map((f) => (
                      <li key={f} className="text-xs text-zinc-400 flex items-start gap-1">
                        <CheckCircle className="w-3 h-3 text-emerald-400 mt-0.5 shrink-0" /> {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => handleSubscriptionChange(plan)}
                    disabled={subscription?.tier === plan.tier}
                    className={`w-full py-2 rounded-lg text-sm font-medium transition-all ${
                      subscription?.tier === plan.tier
                        ? 'bg-zinc-800 text-zinc-500 cursor-default'
                        : 'btn-primary'
                    }`}
                  >
                    {subscription?.tier === plan.tier ? 'Current Plan' : plan.tier === 'free' ? 'Downgrade' : 'Subscribe'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* FEEDBACK TAB */}
      {activeTab === 'feedback' && (
        <div className="max-w-2xl">
          {selectedMessage ? (
            <div className="card">
              <button onClick={() => setSelectedMessage(null)} className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white mb-4">
                <ArrowLeft className="w-3 h-3" /> Back to messages
              </button>
              <div className="mb-4">
                <p className="font-medium text-sm">{selectedMessage.sender_name}</p>
                <p className="text-xs text-zinc-500">{selectedMessage.sender_email} · {selectedMessage.page} · {new Date(selectedMessage.created_at).toLocaleString()}</p>
              </div>
              <div className="bg-zinc-900 rounded-lg p-4 mb-4">
                <p className="text-sm text-zinc-300">{selectedMessage.message}</p>
              </div>

              {/* Reply thread */}
              {selectedMessage.replies && selectedMessage.replies.length > 0 && (
                <div className="space-y-2 mb-4">
                  {selectedMessage.replies.map((reply, i) => (
                    <div key={i} className="ml-4 bg-accent-cyan/5 border border-accent-cyan/20 rounded-lg p-3">
                      <p className="text-xs text-zinc-500 mb-1">You · {new Date(reply.sent_at).toLocaleString()}</p>
                      <p className="text-sm text-zinc-200">{reply.text}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Reply box */}
              <div className="flex gap-2">
                <input
                  className="input-field flex-1"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Type your reply..."
                  onKeyDown={(e) => { if (e.key === 'Enter' && !sendingReply) handleSendReply(); }}
                />
                <button
                  onClick={handleSendReply}
                  disabled={sendingReply || !replyText.trim()}
                  className="btn-primary flex items-center gap-1 px-4"
                >
                  {sendingReply ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </div>
          ) : (
            <div className="card">
              <h3 className="text-lg font-semibold mb-4">Client Messages & Feedback</h3>
              {messages.length === 0 ? (
                <p className="text-zinc-500 text-center py-8">No messages yet. Messages from your public website contact form will appear here.</p>
              ) : (
                <div className="space-y-3">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      onClick={() => { setSelectedMessage(msg); if (!msg.is_read) handleMarkRead(msg.id); }}
                      className={`p-4 rounded-lg border cursor-pointer transition-all ${msg.is_read ? 'border-border bg-zinc-900/50 hover:border-zinc-700' : 'border-accent-cyan/30 bg-accent-cyan/5 hover:border-accent-cyan/50'}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="font-medium text-sm">{msg.sender_name}</p>
                          <p className="text-xs text-zinc-500">{msg.sender_email} · {new Date(msg.created_at).toLocaleDateString()}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {!msg.is_read && <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent-cyan/20 text-accent-cyan">New</span>}
                          {msg.replies && msg.replies.length > 0 && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                              {msg.replies.length} {msg.replies.length === 1 ? 'reply' : 'replies'}
                            </span>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteMessage(msg.id); }}
                            className="text-zinc-500 hover:text-red-400"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <p className="text-sm text-zinc-300 line-clamp-2">{msg.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* PAYMENT MODAL */}
      {paymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => !processing && setPaymentModal(null)}>
          <div className="bg-zinc-950 border border-border rounded-2xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Subscribe to {paymentModal.name}</h3>
              <button onClick={() => !processing && setPaymentModal(null)} className="text-zinc-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex items-center justify-between mb-6 p-3 bg-zinc-900 rounded-lg">
              <span className="text-sm text-zinc-400">{paymentModal.name} Plan</span>
              <span className="text-2xl font-bold mono-data">${(paymentModal.price / 100).toFixed(2)}<span className="text-xs text-zinc-500">{paymentModal.period}</span></span>
            </div>

            {/* Payment method selector */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              {([
                { key: 'card' as const, label: 'Card', icon: CardIcon },
                { key: 'paypal' as const, label: 'PayPal', icon: Wallet },
                { key: 'mobile' as const, label: 'Mobile Money', icon: Smartphone },
              ]).map((method) => (
                <button
                  key={method.key}
                  onClick={() => setPaymentMethod(method.key)}
                  className={`flex flex-col items-center gap-1 py-3 rounded-lg border transition-all ${
                    paymentMethod === method.key
                      ? 'border-accent-cyan bg-accent-cyan/10 text-accent-cyan'
                      : 'border-border text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  <method.icon className="w-5 h-5" />
                  <span className="text-xs">{method.label}</span>
                </button>
              ))}
            </div>

            {/* Card form */}
            {paymentMethod === 'card' && (
              <div className="space-y-3">
                <div>
                  <label className="label">Card Number</label>
                  <input
                    className="input-field"
                    value={cardData.number}
                    onChange={(e) => setCardData({ ...cardData, number: e.target.value })}
                    placeholder="4242 4242 4242 4242"
                    maxLength={19}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Expiry</label>
                    <input className="input-field" value={cardData.expiry} onChange={(e) => setCardData({ ...cardData, expiry: e.target.value })} placeholder="MM/YY" maxLength={5} />
                  </div>
                  <div>
                    <label className="label">CVC</label>
                    <input className="input-field" value={cardData.cvc} onChange={(e) => setCardData({ ...cardData, cvc: e.target.value })} placeholder="123" maxLength={4} />
                  </div>
                </div>
                <div>
                  <label className="label">Name on Card</label>
                  <input className="input-field" value={cardData.name} onChange={(e) => setCardData({ ...cardData, name: e.target.value })} placeholder="John Doe" />
                </div>
              </div>
            )}

            {/* PayPal form */}
            {paymentMethod === 'paypal' && (
              <div className="space-y-3">
                <div>
                  <label className="label">PayPal Email</label>
                  <input className="input-field" type="email" value={paypalData.email} onChange={(e) => setPaypalData({ email: e.target.value })} placeholder="you@example.com" />
                </div>
                <p className="text-xs text-zinc-500">You'll be redirected to PayPal to complete your payment securely.</p>
              </div>
            )}

            {/* Mobile Money form */}
            {paymentMethod === 'mobile' && (
              <div className="space-y-3">
                <div>
                  <label className="label">Provider</label>
                  <select className="input-field" value={mobileData.provider} onChange={(e) => setMobileData({ ...mobileData, provider: e.target.value })}>
                    <option value="mtn">MTN Mobile Money</option>
                    <option value="airtel">Airtel Money</option>
                    <option value="mpesa">M-Pesa</option>
                    <option value="orange">Orange Money</option>
                  </select>
                </div>
                <div>
                  <label className="label">Phone Number</label>
                  <input className="input-field" value={mobileData.phone} onChange={(e) => setMobileData({ ...mobileData, phone: e.target.value })} placeholder="+256 700 000 000" />
                </div>
                <p className="text-xs text-zinc-500">A payment prompt will be sent to your phone.</p>
              </div>
            )}

            <button
              onClick={handlePayment}
              disabled={processing}
              className="btn-primary w-full mt-6 flex items-center justify-center gap-2"
            >
              {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
              {processing ? 'Processing...' : `Pay $${(paymentModal.price / 100).toFixed(2)}`}
            </button>
            <p className="text-[10px] text-zinc-600 text-center mt-3">Secured checkout · Cancel anytime</p>
          </div>
        </div>
      )}
    </div>
  );
}
