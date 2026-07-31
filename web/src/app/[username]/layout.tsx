'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Globe, Menu, X } from 'lucide-react';
import { gatekeeper, GatekeeperProfile, GatekeeperBlock } from '@/lib/api';

export default function PublicSiteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ username: string }>;
}) {
  const { username } = use(params);
  const [profile, setProfile] = useState<GatekeeperProfile | null>(null);
  const [blocks, setBlocks] = useState<GatekeeperBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [found, setFound] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    gatekeeper.getSite(username)
      .then((data) => {
        setProfile(data.profile);
        setBlocks(data.blocks || []);
      })
      .catch(() => setFound(false))
      .finally(() => setLoading(false));
  }, [username]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-zinc-600 border-t-emerald-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (!found || !profile) {
    notFound();
  }

  const theme = parseTheme(profile);
  const navItems = [
    { href: `/${username}`, label: 'Home' },
    { href: `/${username}/details`, label: 'Details' },
    { href: `/${username}/about`, label: 'About' },
    { href: `/${username}/contact`, label: 'Contact' },
  ];

  return (
    <div className="min-h-screen bg-white text-zinc-900">
      <PublicNav
        profile={profile}
        username={username}
        navItems={navItems}
        primary={theme.primary}
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
      />
      <main>{children}</main>
      <PublicFooter profile={profile} blocks={blocks} username={username} primary={theme.primary} />
    </div>
  );
}

function PublicNav({
  profile, username, navItems, primary, menuOpen, setMenuOpen,
}: {
  profile: GatekeeperProfile;
  username: string;
  navItems: { href: string; label: string }[];
  primary: string;
  menuOpen: boolean;
  setMenuOpen: (v: boolean) => void;
}) {
  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-zinc-200 shadow-sm">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href={`/${username}`} className="flex items-center gap-2">
          {profile.avatar_url ? (
            <img src={profile.avatar_url || undefined} alt={profile.display_name || undefined} className="w-9 h-9 rounded-full object-cover" />
          ) : (
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold" style={{ background: primary }}>
              {(profile.display_name || 'T').charAt(0).toUpperCase()}
            </div>
          )}
          <span className="font-bold text-lg">{profile.display_name || username}</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
            >
              {item.label}
            </Link>
          ))}
          <Link
            href={`/${username}/contact`}
            className="ml-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90"
            style={{ background: primary }}
          >
            Get in Touch
          </Link>
        </nav>

        <button className="md:hidden p-2" onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>
      {menuOpen && (
        <nav className="md:hidden border-t border-zinc-200 bg-white">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMenuOpen(false)}
              className="block px-6 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-100 border-b border-zinc-100"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}

function PublicFooter({
  profile, blocks, username, primary,
}: {
  profile: GatekeeperProfile;
  blocks: GatekeeperBlock[];
  username: string;
  primary: string;
}) {
  const socialLinks = parseSocialLinks(profile);
  const footerLinks = [
    { href: `/${username}`, label: 'Home' },
    { href: `/${username}/details`, label: 'Details' },
    { href: `/${username}/about`, label: 'About' },
    { href: `/${username}/contact`, label: 'Contact' },
  ];
  return (
    <footer className="bg-zinc-950 text-zinc-300">
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid md:grid-cols-3 gap-8 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ background: primary }}>
                {(profile.display_name || 'T').charAt(0).toUpperCase()}
              </div>
              <span className="font-bold text-white">{profile.display_name || username}</span>
            </div>
            <p className="text-sm text-zinc-400 max-w-xs">{profile.tagline || profile.bio || 'Trading professional sharing insights and strategies.'}</p>
          </div>
          <div>
            <h4 className="font-semibold text-white mb-3 text-sm">Explore</h4>
            <ul className="space-y-2">
              {footerLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-zinc-400 hover:text-white transition-colors">{link.label}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-white mb-3 text-sm">Connect</h4>
            <div className="flex gap-2">
              {Object.keys(socialLinks).filter((k) => socialLinks[k]).length > 0 ? (
                Object.keys(socialLinks).filter((k) => socialLinks[k]).map((k) => (
                  <a
                    key={k}
                    href={socialLinks[k]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-9 h-9 rounded-lg bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-sm capitalize transition-colors"
                  >
                    {k.charAt(0).toUpperCase()}
                  </a>
                ))
              ) : (
                <p className="text-sm text-zinc-500">No social links yet.</p>
              )}
            </div>
          </div>
        </div>
        <div className="border-t border-zinc-800 pt-6 text-center text-xs text-zinc-500">
          &copy; {new Date().getFullYear()} {profile.display_name || username}. All rights reserved.
        </div>
      </div>
    </footer>
  );
}

function parseTheme(profile: GatekeeperProfile): { primary: string; layout: string } {
  let theme = profile.theme;
  if (typeof theme === 'string') {
    try { theme = JSON.parse(theme); } catch { theme = {}; }
  }
  const t = (theme || {}) as { primary_color?: string; layout?: string };
  return { primary: t.primary_color || '#10b981', layout: t.layout || 'stacked' };
}

function parseSocialLinks(profile: GatekeeperProfile): Record<string, string> {
  let links = profile.social_links;
  if (typeof links === 'string') {
    try { links = JSON.parse(links); } catch { links = {}; }
  }
  return (links || {}) as Record<string, string>;
}
