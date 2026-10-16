'use client';

import { use } from 'react';
import Link from 'next/link';
import { CircleCheck as CheckCircle, Award, Users, TrendingUp, Globe, ArrowRight } from 'lucide-react';
import { usePublicSite, parseTheme } from '../usePublicSite';

export default function AboutPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = use(params);
  const { profile, blocks, loading } = usePublicSite(username);
  const { primary } = parseTheme(profile);

  if (loading || !profile) {
    return <div className="min-h-[60vh] flex items-center justify-center"><div className="w-8 h-8 border-2 border-zinc-300 border-t-zinc-900 rounded-full animate-spin" /></div>;
  }

  const textBlocks = blocks.filter((b) => b.block_type === 'text');

  return (
    <div>
      {/* HEADER */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${primary}12, ${primary}04)` }} />
        <div className="relative max-w-6xl mx-auto px-6 py-20">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="text-4xl font-bold text-zinc-900 mb-4">About {profile.display_name}</h1>
              <p className="text-lg text-zinc-600 leading-relaxed mb-6">
                {profile.bio || `I'm ${profile.display_name}, a dedicated trading professional with years of experience in the markets. I share my strategies, insights, and live trades to help others achieve financial independence through smart trading.`}
              </p>
              <div className="flex flex-wrap gap-2">
                {['Day Trading', 'Swing Trading', 'Risk Management', 'Technical Analysis'].map((tag) => (
                  <span key={tag} className="px-3 py-1 rounded-full text-xs font-medium" style={{ background: `${primary}15`, color: primary }}>{tag}</span>
                ))}
              </div>
            </div>
            <div className="flex justify-center">
              <div className="relative">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url || undefined} alt={profile.display_name || undefined} className="w-64 h-64 rounded-3xl object-cover shadow-2xl" />
                ) : (
                  <img
                    src="https://images.pexels.com/photos/28442318/pexels-photo-28442318.jpeg?auto=compress&cs=tinysrgb&h=650&w=940"
                    alt={profile.display_name || undefined}
                    className="w-64 h-64 rounded-3xl object-cover shadow-2xl"
                  />
                )}
                <div className="absolute -bottom-3 -right-3 w-16 h-16 rounded-2xl bg-white shadow-lg flex items-center justify-center" style={{ border: `3px solid ${primary}` }}>
                  <Award className="w-8 h-8" style={{ color: primary }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* JOURNEY / VALUES */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold mb-8 text-center">My Journey</h2>
        <div className="space-y-6">
          {textBlocks.length > 0 ? (
            textBlocks.map((block) => (
              <div key={block.id} className="bg-zinc-50 rounded-xl p-6">
                <h3 className="font-bold text-lg mb-2">{block.title}</h3>
                <p className="text-zinc-600 leading-relaxed">{block.content}</p>
              </div>
            ))
          ) : (
            <>
              <div className="bg-zinc-50 rounded-xl p-6">
                <h3 className="font-bold text-lg mb-2">Getting Started</h3>
                <p className="text-zinc-600 leading-relaxed">I began my trading journey fascinated by the markets. Through years of trial, error, and continuous learning, I developed a disciplined approach focused on risk management and consistent growth.</p>
              </div>
              <div className="bg-zinc-50 rounded-xl p-6">
                <h3 className="font-bold text-lg mb-2">My Philosophy</h3>
                <p className="text-zinc-600 leading-relaxed">Trading isn't about getting rich quick — it's about consistent, repeatable processes. I focus on high-probability setups, strict risk controls, and letting the math work in my favor over time.</p>
              </div>
              <div className="bg-zinc-50 rounded-xl p-6">
                <h3 className="font-bold text-lg mb-2">Why I Share</h3>
                <p className="text-zinc-600 leading-relaxed">I believe in transparency and community. By sharing my trades and teaching my methods, I help others avoid the costly mistakes I made early on — while building a network of like-minded traders across time zones.</p>
              </div>
            </>
          )}
        </div>
      </section>

      {/* VALUES GRID */}
      <section className="bg-zinc-50 border-y border-zinc-200">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold mb-8 text-center">What I Stand For</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: TrendingUp, title: 'Transparency', desc: 'Every trade is shared in real-time with full context — entries, exits, and the reasoning behind them.' },
              { icon: Users, title: 'Community', desc: 'Building a global network of traders who learn from each other across every time zone.' },
              { icon: CheckCircle, title: 'Discipline', desc: 'Risk management comes first. No trade is taken without a defined plan and stop loss.' },
            ].map((item) => (
              <div key={item.title} className="bg-white rounded-2xl p-8 text-center">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: `${primary}15` }}>
                  <item.icon className="w-7 h-7" style={{ color: primary }} />
                </div>
                <h3 className="font-bold text-lg mb-2">{item.title}</h3>
                <p className="text-sm text-zinc-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-6 py-20 text-center">
        <h2 className="text-3xl font-bold text-zinc-900 mb-4">Let's Connect</h2>
        <p className="text-zinc-500 mb-8 max-w-xl mx-auto">Have questions about my approach or want to learn more? I'd love to hear from you.</p>
        <Link href={`/${username}/contact`} className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-white font-bold text-lg transition-all hover:opacity-90 hover:scale-105" style={{ background: primary }}>
          Send a Message <ArrowRight className="w-5 h-5" />
        </Link>
      </section>
    </div>
  );
}
