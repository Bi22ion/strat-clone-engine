'use client';

import { use } from 'react';
import Link from 'next/link';
import { Video, Play, FileText, TrendingUp, ArrowRight, Clock, ChartBar as BarChart3 } from 'lucide-react';
import { usePublicSite, parseTheme } from '../usePublicSite';

export default function DetailsPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = use(params);
  const { profile, blocks, loading } = usePublicSite(username);
  const { primary } = parseTheme(profile);

  if (loading || !profile) {
    return <div className="min-h-[60vh] flex items-center justify-center"><div className="w-8 h-8 border-2 border-zinc-300 border-t-zinc-900 rounded-full animate-spin" /></div>;
  }

  const videoBlocks = blocks.filter((b) => b.block_type === 'video' || b.block_type === 'trade_class');
  const textBlocks = blocks.filter((b) => b.block_type === 'text');
  const statsBlock = blocks.find((b) => b.block_type === 'stats');

  return (
    <div>
      {/* HEADER */}
      <section className="bg-zinc-50 border-b border-zinc-200">
        <div className="max-w-6xl mx-auto px-6 py-16 text-center">
          <h1 className="text-4xl font-bold text-zinc-900 mb-3">Details & Offerings</h1>
          <p className="text-lg text-zinc-500 max-w-2xl mx-auto">
            Explore my trading classes, video sessions, and detailed strategy breakdowns.
          </p>
        </div>
      </section>

      {/* CLASSES / VIDEOS */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold mb-8 flex items-center gap-2">
          <Video className="w-6 h-6" style={{ color: primary }} /> Trading Classes
        </h2>
        {videoBlocks.length > 0 ? (
          <div className="grid md:grid-cols-2 gap-6">
            {videoBlocks.map((block, i) => (
              <div key={block.id} className="bg-white rounded-2xl border border-zinc-200 overflow-hidden hover:shadow-xl transition-shadow">
                <div className="aspect-video bg-zinc-900 relative overflow-hidden">
                  {block.media_url ? (
                    <img src={block.media_url || undefined} alt={block.title || undefined} className="w-full h-full object-cover" />
                  ) : (
                    <img
                      src={i % 2 === 0
                        ? 'https://images.pexels.com/photos/38375328/pexels-photo-38375328.jpeg?auto=compress&cs=tinysrgb&h=650&w=940'
                        : 'https://images.pexels.com/photos/35118208/pexels-photo-35118208.jpeg?auto=compress&cs=tinysrgb&h=650&w=940'}
                      alt={block.title || 'Trading'}
                      className="w-full h-full object-cover"
                    />
                  )}
                  <div className="absolute top-3 left-3 px-2 py-1 rounded-md text-[10px] font-bold uppercase text-white" style={{ background: primary }}>
                    {block.block_type === 'video' ? 'Video' : 'Class'}
                  </div>
                </div>
                <div className="p-5">
                  <div className="flex items-center gap-2 text-xs text-zinc-400 mb-2">
                    <Clock className="w-3.5 h-3.5" /> Session {i + 1}
                  </div>
                  <h3 className="font-bold text-lg mb-2">{block.title || `Trading Session ${i + 1}`}</h3>
                  <p className="text-sm text-zinc-500 mb-4">{block.content || 'A detailed breakdown of my trading approach and methodology.'}</p>
                  <button className="inline-flex items-center gap-2 text-sm font-semibold transition-colors" style={{ color: primary }}>
                    <Play className="w-4 h-4" /> Watch Preview
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-zinc-50 rounded-2xl">
            <Video className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
            <p className="text-zinc-400">Classes are being prepared. Check back soon!</p>
          </div>
        )}
      </section>

      {/* STRATEGY BREAKDOWNS */}
      {textBlocks.length > 0 && (
        <section className="bg-zinc-50 border-y border-zinc-200">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl font-bold mb-8 flex items-center gap-2">
              <FileText className="w-6 h-6" style={{ color: primary }} /> Strategy Breakdowns
            </h2>
            <div className="space-y-6">
              {textBlocks.map((block) => (
                <div key={block.id} className="bg-white rounded-xl p-6 border border-zinc-200">
                  <h3 className="font-bold text-lg mb-2">{block.title}</h3>
                  <p className="text-zinc-600 leading-relaxed">{block.content}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* PERFORMANCE SUMMARY */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold mb-8 flex items-center gap-2">
          <BarChart3 className="w-6 h-6" style={{ color: primary }} /> Performance Overview
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Monthly Return', value: '+12.4%', color: primary },
            { label: 'Max Drawdown', value: '-5.2%', color: '#ef4444' },
            { label: 'Sharpe Ratio', value: '1.84', color: primary },
            { label: 'Avg. Hold Time', value: '4.2h', color: primary },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-xl p-6 border border-zinc-200 text-center">
              <p className="text-3xl font-bold mb-1" style={{ color: stat.color }}>{stat.value}</p>
              <p className="text-sm text-zinc-500">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <div className="rounded-2xl bg-zinc-900 p-12 text-center">
          <h2 className="text-2xl font-bold text-white mb-3">Want to learn more?</h2>
          <p className="text-zinc-400 mb-6">Get in touch and I'll personally respond to your questions.</p>
          <Link href={`/${username}/contact`} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white transition-all hover:opacity-90" style={{ background: primary }}>
            Contact Me <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
