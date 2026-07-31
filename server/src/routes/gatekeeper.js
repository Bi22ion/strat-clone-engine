import { Router } from 'express';
import { query } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import { ensureGatekeeperSchema, seedDefaultProfile, getProfileWithBlocks } from '../services/gatekeeperService.js';

const router = Router();

const TIER_PRICES = { free: 0, weekly: 499, monthly: 1499, yearly: 14999 };

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100) || `trader-${Math.random().toString(36).slice(2, 8)}`;
}

function parseJsonField(value, fallback) {
  if (!value) return fallback;
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch { return fallback; }
  }
  return value;
}

// GET /api/gatekeeper/profile — current user's profile + blocks
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    await ensureGatekeeperSchema();
    let data = await getProfileWithBlocks(req.user.id);
    if (!data) {
      const userRes = await query('SELECT email, full_name FROM users WHERE id = $1', [req.user.id]).catch(() => ({ rows: [{}] }));
      const u = userRes.rows[0] || {};
      await seedDefaultProfile(req.user.id, u.full_name, u.email);
      data = await getProfileWithBlocks(req.user.id);
    }
    if (!data) return res.status(404).json({ error: 'Profile not found' });
    res.json(data);
  } catch (err) {
    console.error('Gatekeeper profile error:', err);
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

// PUT /api/gatekeeper/profile — update profile fields
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    await ensureGatekeeperSchema();
    const {
      display_name, tagline, bio, avatar_url, cover_url,
      is_published, template, social_links, theme, slug,
    } = req.body;

    const existing = await query('SELECT * FROM gatekeeper_profiles WHERE owner_id = $1', [req.user.id]).catch(() => ({ rows: [] }));
    if (existing.rows.length === 0) {
      const userRes = await query('SELECT email, full_name FROM users WHERE id = $1', [req.user.id]).catch(() => ({ rows: [{}] }));
      await seedDefaultProfile(req.user.id, userRes.rows[0]?.full_name, userRes.rows[0]?.email);
    }

    const cleanSlug = slug ? slugify(slug) : undefined;
    const result = await query(
      `UPDATE gatekeeper_profiles SET
        display_name = COALESCE($1, display_name),
        tagline = COALESCE($2, tagline),
        bio = COALESCE($3, bio),
        avatar_url = COALESCE($4, avatar_url),
        cover_url = COALESCE($5, cover_url),
        is_published = COALESCE($6, is_published),
        template = COALESCE($7, template),
        social_links = COALESCE($8, social_links),
        theme = COALESCE($9, theme),
        slug = COALESCE($10, slug)
       WHERE owner_id = $11 RETURNING *`,
      [
        display_name ?? null,
        tagline ?? null,
        bio ?? null,
        avatar_url ?? null,
        cover_url ?? null,
        is_published ?? null,
        template ?? null,
        social_links ? JSON.stringify(social_links) : null,
        theme ? JSON.stringify(theme) : null,
        cleanSlug ?? null,
        req.user.id,
      ]
    ).catch(() => ({ rows: [] }));

    if (result.rows.length === 0) return res.status(404).json({ error: 'Profile not found' });
    res.json({ profile: result.rows[0] });
  } catch (err) {
    console.error('Gatekeeper update error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// POST /api/gatekeeper/blocks — add a block
router.post('/blocks', authMiddleware, async (req, res) => {
  try {
    await ensureGatekeeperSchema();
    const { block_type = 'text', title, content, media_url, layout, sort_order, is_visible = true } = req.body;

    const profileRes = await query('SELECT id FROM gatekeeper_profiles WHERE owner_id = $1', [req.user.id]).catch(() => ({ rows: [] }));
    if (profileRes.rows.length === 0) return res.status(404).json({ error: 'Profile not found' });

    const order = sort_order ?? 0;
    const result = await query(
      `INSERT INTO gatekeeper_blocks (profile_id, block_type, title, content, media_url, layout, sort_order, is_visible)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        profileRes.rows[0].id,
        block_type,
        title ?? null,
        content ?? null,
        media_url ?? null,
        layout ? JSON.stringify(layout) : '{}',
        order,
        is_visible,
      ]
    ).catch(() => ({ rows: [] }));

    res.status(201).json({ block: result.rows[0] });
  } catch (err) {
    console.error('Create block error:', err);
    res.status(500).json({ error: 'Failed to create block' });
  }
});

// PUT /api/gatekeeper/blocks/:id — update a block
router.put('/blocks/:id', authMiddleware, async (req, res) => {
  try {
    const { title, content, media_url, layout, sort_order, is_visible, block_type } = req.body;
    const result = await query(
      `UPDATE gatekeeper_blocks b SET
        block_type = COALESCE($1, b.block_type),
        title = COALESCE($2, b.title),
        content = COALESCE($3, b.content),
        media_url = COALESCE($4, b.media_url),
        layout = COALESCE($5, b.layout),
        sort_order = COALESCE($6, b.sort_order),
        is_visible = COALESCE($7, b.is_visible)
       FROM gatekeeper_profiles p
       WHERE b.id = $8 AND b.profile_id = p.id AND p.owner_id = $9
       RETURNING b.*`,
      [
        block_type ?? null,
        title ?? null,
        content ?? null,
        media_url ?? null,
        layout ? JSON.stringify(layout) : null,
        sort_order ?? null,
        is_visible ?? null,
        req.params.id,
        req.user.id,
      ]
    ).catch(() => ({ rows: [] }));

    if (result.rows.length === 0) return res.status(404).json({ error: 'Block not found' });
    res.json({ block: result.rows[0] });
  } catch (err) {
    console.error('Update block error:', err);
    res.status(500).json({ error: 'Failed to update block' });
  }
});

// DELETE /api/gatekeeper/blocks/:id
router.delete('/blocks/:id', authMiddleware, async (req, res) => {
  try {
    const result = await query(
      `DELETE FROM gatekeeper_blocks b
       USING gatekeeper_profiles p
       WHERE b.id = $1 AND b.profile_id = p.id AND p.owner_id = $2 RETURNING b.id`,
      [req.params.id, req.user.id]
    ).catch(() => ({ rows: [] }));
    if (result.rows.length === 0) return res.status(404).json({ error: 'Block not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete block' });
  }
});

// GET /api/gatekeeper/subscription — current user's subscription
router.get('/subscription', authMiddleware, async (req, res) => {
  try {
    await ensureGatekeeperSchema();
    const result = await query(
      'SELECT * FROM gatekeeper_subscriptions WHERE owner_id = $1 ORDER BY created_at DESC LIMIT 1',
      [req.user.id]
    ).catch(() => ({ rows: [] }));
    res.json({ subscription: result.rows[0] || { tier: 'free', status: 'active', price_cents: 0 } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load subscription' });
  }
});

// PUT /api/gatekeeper/subscription — change tier (free during testing)
router.put('/subscription', authMiddleware, async (req, res) => {
  try {
    const { tier } = req.body;
    if (!TIER_PRICES.hasOwnProperty(tier)) return res.status(400).json({ error: 'Invalid tier' });

    const priceCents = TIER_PRICES[tier];
    const result = await query(
      `INSERT INTO gatekeeper_subscriptions (owner_id, tier, status, price_cents)
       VALUES ($1, $2, 'active', $3)
       ON CONFLICT DO NOTHING RETURNING *`,
      [req.user.id, tier, priceCents]
    ).catch(() => ({ rows: [] }));

    let subscription = result.rows[0];
    if (!subscription) {
      const updated = await query(
        `UPDATE gatekeeper_subscriptions SET tier = $1, price_cents = $2, status = 'active'
         WHERE owner_id = $3 RETURNING *`,
        [tier, priceCents, req.user.id]
      ).catch(() => ({ rows: [] }));
      subscription = updated.rows[0];
    }
    res.json({ subscription });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update subscription' });
  }
});

// GET /api/gatekeeper/site/:slug — public profile (no auth)
router.get('/site/:slug', async (req, res) => {
  try {
    const profileRes = await query(
      'SELECT * FROM gatekeeper_profiles WHERE slug = $1 AND is_published = true',
      [req.params.slug]
    ).catch(() => ({ rows: [] }));
    if (profileRes.rows.length === 0) return res.status(404).json({ error: 'Site not found' });

    const profile = profileRes.rows[0];
    const blocksRes = await query(
      'SELECT * FROM gatekeeper_blocks WHERE profile_id = $1 AND is_visible = true ORDER BY sort_order ASC, id ASC',
      [profile.id]
    ).catch(() => ({ rows: [] }));

    res.json({
      profile: {
        ...profile,
        social_links: parseJsonField(profile.social_links, {}),
        theme: parseJsonField(profile.theme, {}),
      },
      blocks: blocksRes.rows.map((b) => ({ ...b, layout: parseJsonField(b.layout, {}) })),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load site' });
  }
});

export default router;
