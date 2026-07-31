'use client';

import { use, useState } from 'react';
import { Mail, MessageSquare, Send, MapPin, Clock, CircleCheck as CheckCircle, Loader as Loader2 } from 'lucide-react';
import { usePublicSite, parseTheme, parseSocialLinks } from '../usePublicSite';
import { gatekeeper } from '@/lib/api';

export default function ContactPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = use(params);
  const { profile, loading } = usePublicSite(username);
  const { primary } = parseTheme(profile);
  const social = parseSocialLinks(profile);

  const [form, setForm] = useState({ sender_name: '', sender_email: '', message: '' });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.sender_name || !form.sender_email || !form.message) {
      setError('Please fill in all fields');
      return;
    }
    setSending(true);
    setError('');
    try {
      await gatekeeper.sendMessage(username, { ...form, page: 'contact' });
      setSent(true);
      setForm({ sender_name: '', sender_email: '', message: '' });
    } catch {
      setError('Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  }

  if (loading || !profile) {
    return <div className="min-h-[60vh] flex items-center justify-center"><div className="w-8 h-8 border-2 border-zinc-300 border-t-zinc-900 rounded-full animate-spin" /></div>;
  }

  return (
    <div>
      {/* HEADER */}
      <section className="bg-zinc-50 border-b border-zinc-200">
        <div className="max-w-6xl mx-auto px-6 py-16 text-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: `${primary}15` }}>
            <MessageSquare className="w-7 h-7" style={{ color: primary }} />
          </div>
          <h1 className="text-4xl font-bold text-zinc-900 mb-3">Get in Touch</h1>
          <p className="text-lg text-zinc-500 max-w-2xl mx-auto">
            Have a question about my trading strategies, classes, or mentorship? Send me a message and I'll get back to you personally.
          </p>
        </div>
      </section>

      {/* CONTACT GRID */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid md:grid-cols-3 gap-8">
          {/* INFO CARDS */}
          <div className="space-y-4">
            <div className="bg-zinc-50 rounded-2xl p-6">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: `${primary}15` }}>
                <Mail className="w-5 h-5" style={{ color: primary }} />
              </div>
              <h3 className="font-bold mb-1">Email Me</h3>
              <p className="text-sm text-zinc-500">I respond to all messages within 24 hours, no matter the time zone.</p>
            </div>
            <div className="bg-zinc-50 rounded-2xl p-6">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: `${primary}15` }}>
                <Clock className="w-5 h-5" style={{ color: primary }} />
              </div>
              <h3 className="font-bold mb-1">Always Available</h3>
              <p className="text-sm text-zinc-500">My site works around the clock so you can reach me while I'm asleep or trading.</p>
            </div>
            <div className="bg-zinc-50 rounded-2xl p-6">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: `${primary}15` }}>
                <MapPin className="w-5 h-5" style={{ color: primary }} />
              </div>
              <h3 className="font-bold mb-1">Global Reach</h3>
              <p className="text-sm text-zinc-500">Connecting with traders worldwide across every market session.</p>
            </div>

            {Object.keys(social).filter((k) => social[k]).length > 0 && (
              <div className="bg-zinc-50 rounded-2xl p-6">
                <h3 className="font-bold mb-3">Follow Me</h3>
                <div className="flex gap-2">
                  {Object.keys(social).filter((k) => social[k]).map((k) => (
                    <a key={k} href={social[k]} target="_blank" rel="noopener noreferrer"
                      className="w-10 h-10 rounded-lg bg-white border border-zinc-200 flex items-center justify-center text-sm capitalize hover:shadow-md transition-shadow">
                      {k.charAt(0).toUpperCase()}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* FORM */}
          <div className="md:col-span-2">
            <div className="bg-white rounded-2xl border border-zinc-200 p-8 shadow-sm">
              {sent ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: `${primary}15` }}>
                    <CheckCircle className="w-8 h-8" style={{ color: primary }} />
                  </div>
                  <h2 className="text-2xl font-bold mb-2">Message Sent!</h2>
                  <p className="text-zinc-500 mb-6">Thank you for reaching out. I'll get back to you as soon as possible.</p>
                  <button onClick={() => setSent(false)} className="px-6 py-3 rounded-xl font-semibold text-white transition-all hover:opacity-90" style={{ background: primary }}>
                    Send Another Message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <h2 className="text-2xl font-bold mb-2">Send a Message</h2>
                  <p className="text-sm text-zinc-500 mb-4">Fill out the form below and I'll personally read and respond to your message.</p>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 mb-1.5">Your Name</label>
                      <input
                        type="text"
                        value={form.sender_name}
                        onChange={(e) => setForm({ ...form, sender_name: e.target.value })}
                        className="w-full border border-zinc-200 rounded-lg px-4 py-2.5 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-offset-0 transition-all"
                        style={{ '--tw-ring-color': primary } as React.CSSProperties}
                        placeholder="Jane Doe"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 mb-1.5">Email Address</label>
                      <input
                        type="email"
                        value={form.sender_email}
                        onChange={(e) => setForm({ ...form, sender_email: e.target.value })}
                        className="w-full border border-zinc-200 rounded-lg px-4 py-2.5 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 transition-all"
                        style={{ '--tw-ring-color': primary } as React.CSSProperties}
                        placeholder="jane@example.com"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1.5">Message</label>
                    <textarea
                      value={form.message}
                      onChange={(e) => setForm({ ...form, message: e.target.value })}
                      rows={6}
                      className="w-full border border-zinc-200 rounded-lg px-4 py-2.5 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 transition-all resize-none"
                      style={{ '--tw-ring-color': primary } as React.CSSProperties}
                      placeholder="Hi! I'm interested in learning more about your trading classes..."
                      required
                    />
                  </div>
                  {error && <p className="text-sm text-red-500">{error}</p>}
                  <button
                    type="submit"
                    disabled={sending}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white font-semibold transition-all hover:opacity-90 disabled:opacity-50"
                    style={{ background: primary }}
                  >
                    {sending ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</> : <><Send className="w-4 h-4" /> Send Message</>}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
