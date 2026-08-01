'use client';

import { use } from 'react';
import Link from 'next/link';
import { ArrowRight, Play, TrendingUp, ChartBar as BarChart3, Video, Sparkles, CircleCheck as CheckCircle, Globe } from 'lucide-react';
import { usePublicSite, parseTheme } from './usePublicSite';

export default function HomePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = use(params);
  const { profile, blocks, loading, error } = usePublicSite(username);
  const { primary } = parseTheme(profile);

  if (loading) {
    return <div className="min-h-[60vh] flex items-center justify-center"><div className="w-8 h-8 border-2 border-zinc-300 border-t-zinc-900 rounded-full animate-spin" /></div>;
  }

  if (error || !profile) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-6 text-center">
        <div className="w-16 h-16 rounded-full bg-zinc-100 flex items-center justify-center mb-4">
          <Globe className="w-8 h-8 text-zinc-400" />
        </div>
        <h1 className="text-2xl font-bold text-zinc-900 mb-2">Site Not Found</h1>
        <p className="text-zinc-500 max-w-md">The page <span className="font-mono text-zinc-700">/{username}</span> doesn&apos;t exist yet. If you&apos;re the owner, make sure your profile is set up from the dashboard.</p>
        <Link href="/dashboard/profile" className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-900 text-white font-medium hover:bg-zinc-800 transition-colors">
          Go to Dashboard
        </Link>
      </div>
    );
  }

  const heroBlock = blocks.find((b) => b.block_type === 'hero');
  const statsBlock = blocks.find((b) => b.block_type === 'stats');
  const videoBlocks = blocks.filter((b) => b.block_type === 'video' || b.block_type === 'trade_class');
  const ctaBlock = blocks.find((b) => b.block_type === 'cta');
  const textBlocks = blocks.filter((b) => b.block_type === 'text');
  const imageBlocks = blocks.filter((b) => b.block_type === 'image');

  return (
    <div>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${primary}15, ${primary}05)` }} />
        <div className="relative max-w-6xl mx-auto px-6 py-20 md:py-28">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-4" style={{ background: `${primary}15`, color: primary }}>
                <Sparkles className="w-3.5 h-3.5" />
                <span className="text-xs font-semibold uppercase tracking-wide">{profile.tagline || 'Trading Professional'}</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-zinc-900 leading-tight mb-4">
                {heroBlock?.title || `Welcome to ${profile.display_name}'s Trading Hub`}
              </h1>
              <p className="text-lg text-zinc-600 mb-8 leading-relaxed max-w-lg">
                {heroBlock?.content || profile.bio || 'Sharing proven trading strategies, live market analysis, and educational content to help you navigate the markets with confidence.'}
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href={`/${username}/details`}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white font-semibold transition-all hover:opacity-90 hover:scale-[1.02]"
                  style={{ background: primary }}
                >
                  Explore My Work <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href={`/${username}/contact`}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border-2 border-zinc-200 text-zinc-700 font-semibold hover:border-zinc-300 hover:bg-zinc-50 transition-all"
                >
                  Get in Touch
                </Link>
              </div>
            </div>
            <div className="relative">
              <div className="rounded-2xl overflow-hidden shadow-2xl">
                {profile.cover_url ? (
                  <img src={profile.cover_url || undefined} alt={profile.display_name || undefined} className="w-full h-80 object-cover" />
                ) : (
                  <img
                    src="https://images.pexels.com/photos/16594725/pexels-photo-16594725.jpeg?auto=compress&cs=tinysrgb&h=650&w=940"
                    alt="Trading charts"
                    className="w-full h-80 object-cover"
                  />
                )}
              </div>
              <div className="absolute -bottom-4 -left-4 bg-white rounded-xl shadow-lg p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `${primary}20` }}>
                  <TrendingUp className="w-5 h-5" style={{ color: primary }} />
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Live Trading</p>
                  <p className="font-bold text-sm">Market Active</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { label: statsBlock?.title || 'Win Rate', value: '78%', icon: TrendingUp },
            { label: 'Years Trading', value: '8+', icon: BarChart3 },
            { label: 'Students Taught', value: '1.2K', icon: CheckCircle },
            { label: 'Trades Shared', value: '3.4K', icon: Play },
          ].map((stat) => (
            <div key={stat.label} className="bg-zinc-50 rounded-2xl p-6 text-center hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ background: `${primary}15` }}>
                <stat.icon className="w-6 h-6" style={{ color: primary }} />
              </div>
              <p className="text-3xl font-bold text-zinc-900 mb-1">{stat.value}</p>
               <p className="text-sm text-zinc-500">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* VIDEO / CLASS SHOWCASE */}
      {videoBlocks.length > 0 && (
        <section className="max-w-6xl mx-auto px-6 py-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-zinc-900 mb-3">Trading Classes & Videos</h2>
            <p className="text-zinc-500 max-w-2xl mx-auto">Learn directly from my trading sessions, breakdowns, and strategy sessions.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {videoBlocks.map((block) => (
              <div key={block.id} className="bg-white rounded-2xl border border-zinc-200 overflow-hidden hover:shadow-xl transition-shadow group">
                <div className="aspect-video bg-zinc-900 relative overflow-hidden">
                  {block.media_url ? (
                    block.block_type === 'video' ? (
                      <img src={block.media_url || undefined} alt={block.title || undefined} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <img src={block.media_url || undefined} alt={block.title || undefined} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    )
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <img
                        src="https://images.pexels.com/photos/7947742/pexels-photo-7947742.jpeg?auto=compress&cs=tinysrgb&h=650&w=940"
                        alt="Trading analysis"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center">
                      <Play className="w-6 h-6 text-zinc-900 ml-1" />
                    </div>
                  </div>
                </div>
                <div className="p-5">
                  <h3 className="font-bold text-lg mb-1">{block.title || 'Trading Session'}</h3>
                  <p className="text-sm text-zinc-500 line-clamp-2">{block.content || 'Watch this detailed trading breakdown and analysis.'}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* TEXT SECTIONS */}
      {textBlocks.length > 0 && (
        <section className="max-w-4xl mx-auto px-6 py-16 space-y-8">
          {textBlocks.map((block) => (
            <div key={block.id}>
              <h2 className="text-2xl font-bold text-zinc-900 mb-3">{block.title}</h2>
              <p className="text-zinc-600 leading-relaxed">{block.content}</p>
            </div>
          ))}
        </section>
      )}

      {/* IMAGE GALLERY */}
      {imageBlocks.length > 0 && (
        <section className="max-w-6xl mx-auto px-6 py-16">
          <h2 className="text-3xl font-bold text-zinc-900 mb-8 text-center">Gallery</h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
            {imageBlocks.map((block) => (
              <div key={block.id} className="rounded-xl overflow-hidden aspect-square">
                {block.media_url ? (
                  <img src={block.media_url || undefined} alt={block.title || undefined} className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
                ) : (
                  <img
                    src="https://images.pexels.com/photos/6770610/pexels-photo-6770610.jpeg?auto=compress&cs=tinysrgb&h=650&w=940"
                    alt={block.title || 'Trading'}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                  />
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="rounded-3xl p-12 text-center" style={{ background: `linear-gradient(135deg, ${primary}, ${primary}dd)` }}>
          <h2 className="text-3xl font-bold text-white mb-4">{ctaBlock?.title || 'Ready to Trade Alongside Me?'}</h2>
          <p className="text-white/90 mb-8 max-w-xl mx-auto">{ctaBlock?.content || 'Join my community and get access to live trade alerts, educational content, and personal mentorship.'}</p>
          <Link
            href={`/${username}/contact`}
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-white font-bold text-lg transition-all hover:scale-105"
            style={{ color: primary }}
          >
            {ctaBlock?.title || 'Get Started Today'} <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>
    </div>
  );
}
