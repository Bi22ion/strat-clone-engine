import { query } from '../db.js';

const DEFAULT_BLOCKS = [
  { block_type: 'hero', title: 'Trade with Confidence', content: 'I share my live setups, classes, and reflections so you can learn while I sleep.', sort_order: 0 },
  { block_type: 'stats', title: 'Track Record', content: 'Win rate and risk/reward pulled from my Strat-Clone models.', sort_order: 1 },
  { block_type: 'video', title: 'Latest Class Replay', content: 'Catch the session you missed — time-zone friendly replays.', sort_order: 2 },
  { block_type: 'cta', title: 'Join My Next Live Session', content: 'Follow along and ask questions in real time.', sort_order: 3 },
];

export async function ensureGatekeeperSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS gatekeeper_profiles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id UUID NOT NULL,
      slug VARCHAR(100) UNIQUE,
      display_name VARCHAR(255),
      tagline VARCHAR(255),
      bio TEXT,
      avatar_url TEXT,
      cover_url TEXT,
      is_published BOOLEAN NOT NULL DEFAULT false,
      template VARCHAR(50) NOT NULL DEFAULT 'gift-default',
      social_links JSONB NOT NULL DEFAULT '{}'::jsonb,
      theme JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `).catch(() => {});

  await query(`CREATE INDEX IF NOT EXISTS idx_gatekeeper_profiles_owner ON gatekeeper_profiles(owner_id)`).catch(() => {});
  await query(`CREATE INDEX IF NOT EXISTS idx_gatekeeper_profiles_slug ON gatekeeper_profiles(slug)`).catch(() => {});

  await query(`
    CREATE TABLE IF NOT EXISTS gatekeeper_blocks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      profile_id UUID NOT NULL REFERENCES gatekeeper_profiles(id) ON DELETE CASCADE,
      block_type VARCHAR(50) NOT NULL DEFAULT 'text',
      title VARCHAR(255),
      content TEXT,
      media_url TEXT,
      layout JSONB NOT NULL DEFAULT '{}'::jsonb,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_visible BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `).catch(() => {});

  await query(`CREATE INDEX IF NOT EXISTS idx_gatekeeper_blocks_profile ON gatekeeper_blocks(profile_id)`).catch(() => {});
  await query(`CREATE INDEX IF NOT EXISTS idx_gatekeeper_blocks_order ON gatekeeper_blocks(profile_id, sort_order)`).catch(() => {});

  await query(`
    CREATE TABLE IF NOT EXISTS gatekeeper_subscriptions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id UUID NOT NULL,
      tier VARCHAR(20) NOT NULL DEFAULT 'free',
      status VARCHAR(20) NOT NULL DEFAULT 'active',
      price_cents INTEGER NOT NULL DEFAULT 0,
      currency VARCHAR(10) NOT NULL DEFAULT 'usd',
      started_at TIMESTAMPTZ DEFAULT NOW(),
      ends_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `).catch(() => {});

  await query(`CREATE INDEX IF NOT EXISTS idx_gatekeeper_subscriptions_owner ON gatekeeper_subscriptions(owner_id)`).catch(() => {});

  await query(`
    CREATE TABLE IF NOT EXISTS gatekeeper_roles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL UNIQUE,
      role VARCHAR(20) NOT NULL DEFAULT 'trader',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `).catch(() => {});

  await query(`
    CREATE TABLE IF NOT EXISTS gatekeeper_admin_status (
      user_id UUID NOT NULL UNIQUE,
      email TEXT NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'approved' CHECK (status IN ('pending','approved','revoked')),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `).catch(() => {});

  // Backfill approval_status column on roles if missing (idempotent)
  await query(`ALTER TABLE gatekeeper_roles ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) NOT NULL DEFAULT 'approved'`).catch(() => {});

  await query(`
    CREATE OR REPLACE FUNCTION gatekeeper_touch_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
    $$ LANGUAGE plpgsql
  `).catch(() => {});

  await query(`DROP TRIGGER IF EXISTS gatekeeper_profiles_touch ON gatekeeper_profiles`).catch(() => {});
  await query(`CREATE TRIGGER gatekeeper_profiles_touch BEFORE UPDATE ON gatekeeper_profiles FOR EACH ROW EXECUTE FUNCTION gatekeeper_touch_updated_at()`).catch(() => {});
  await query(`DROP TRIGGER IF EXISTS gatekeeper_blocks_touch ON gatekeeper_blocks`).catch(() => {});
  await query(`CREATE TRIGGER gatekeeper_blocks_touch BEFORE UPDATE ON gatekeeper_blocks FOR EACH ROW EXECUTE FUNCTION gatekeeper_touch_updated_at()`).catch(() => {});
  await query(`DROP TRIGGER IF EXISTS gatekeeper_blocks_touch ON gatekeeper_subscriptions`).catch(() => {});
  await query(`CREATE TRIGGER gatekeeper_subscriptions_touch BEFORE UPDATE ON gatekeeper_subscriptions FOR EACH ROW EXECUTE FUNCTION gatekeeper_touch_updated_at()`).catch(() => {});
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100) || `trader-${Math.random().toString(36).slice(2, 8)}`;
}

export async function seedDefaultProfile(userId, displayName, email) {
  const name = displayName || (email ? email.split('@')[0] : 'Trader');
  const slug = slugify(name);

  const profileResult = await query(
    `INSERT INTO gatekeeper_profiles (owner_id, slug, display_name, tagline, bio, is_published, template, theme)
     VALUES ($1, $2, $3, $4, $5, false, 'gift-default', $6)
     ON CONFLICT (owner_id) DO NOTHING
     RETURNING *`,
    [
      userId,
      slug,
      name,
      'Sharing my edge with the world.',
      `Welcome to ${name}'s trading hub.`,
      JSON.stringify({ primary_color: '#10b981', font: 'inter', layout: 'stacked' }),
    ]
  ).catch(() => ({ rows: [] }));

  let profile = profileResult.rows[0];
  if (!profile) {
    const existing = await query('SELECT * FROM gatekeeper_profiles WHERE owner_id = $1', [userId]).catch(() => ({ rows: [] }));
    profile = existing.rows[0];
  }
  if (!profile) return null;

  await query(
    `INSERT INTO gatekeeper_roles (user_id, role) VALUES ($1, 'trader') ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  ).catch(() => {});

  await query(
    `INSERT INTO gatekeeper_admin_status (user_id, email, status) VALUES ($1, $2, 'approved')
     ON CONFLICT (user_id) DO NOTHING`,
    [userId, email || '']
  ).catch(() => {});

  await query(
    `INSERT INTO gatekeeper_subscriptions (owner_id, tier, status, price_cents) VALUES ($1, 'free', 'active', 0)
     ON CONFLICT DO NOTHING`,
    [userId]
  ).catch(() => {});

  const blockCheck = await query('SELECT COUNT(*) FROM gatekeeper_blocks WHERE profile_id = $1', [profile.id]).catch(() => ({ rows: [{ count: '0' }] }));
  if (parseInt(blockCheck.rows[0]?.count || '0', 10) === 0) {
    for (const block of DEFAULT_BLOCKS) {
      await query(
        `INSERT INTO gatekeeper_blocks (profile_id, block_type, title, content, sort_order, is_visible)
         VALUES ($1, $2, $3, $4, $5, true)`,
        [profile.id, block.block_type, block.title, block.content, block.sort_order]
      ).catch(() => {});
    }
  }

  return profile;
}

export async function getProfileWithBlocks(userId) {
  const profileRes = await query('SELECT * FROM gatekeeper_profiles WHERE owner_id = $1', [userId]).catch(() => ({ rows: [] }));
  if (profileRes.rows.length === 0) return null;
  const profile = profileRes.rows[0];
  const blocksRes = await query(
    'SELECT * FROM gatekeeper_blocks WHERE profile_id = $1 ORDER BY sort_order ASC, id ASC',
    [profile.id]
  ).catch(() => ({ rows: [] }));
  return { profile, blocks: blocksRes.rows };
}
