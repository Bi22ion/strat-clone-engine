import { Router } from 'express';
import multer from 'multer';
import { supabase } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import { ensureGatekeeperSchema, seedDefaultProfile, getProfileWithBlocks } from '../services/gatekeeperService.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

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

// GET /api/gatekeeper/status
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const { data: role } = await supabase
      .from('gatekeeper_roles')
      .select('role')
      .eq('user_id', req.user.id)
      .maybeSingle();

    const { data: status } = await supabase
      .from('gatekeeper_admin_status')
      .select('status, email')
      .eq('user_id', req.user.id)
      .maybeSingle();

    res.json({
      role: role?.role || 'trader',
      approvalStatus: status?.status || 'approved',
      email: status?.email || req.user.email,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load status' });
  }
});

// GET /api/gatekeeper/profile
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    let data = await getProfileWithBlocks(req.user.id);
    if (!data) {
      const { data: user } = await supabase
        .from('users')
        .select('email, full_name')
        .eq('id', req.user.id)
        .maybeSingle();
      const u = user || {};
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

// PUT /api/gatekeeper/profile
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const {
      display_name, tagline, bio, avatar_url, cover_url,
      is_published, template, social_links, theme, slug, metadata,
    } = req.body;

    const { data: existing } = await supabase
      .from('gatekeeper_profiles')
      .select('*')
      .eq('owner_id', req.user.id)
      .maybeSingle();

    if (!existing) {
      const { data: user } = await supabase
        .from('users')
        .select('email, full_name')
        .eq('id', req.user.id)
        .maybeSingle();
      await seedDefaultProfile(req.user.id, user?.full_name, user?.email);
    }

    const updates = {};
    if (display_name !== undefined) updates.display_name = display_name;
    if (tagline !== undefined) updates.tagline = tagline;
    if (bio !== undefined) updates.bio = bio;
    if (avatar_url !== undefined) updates.avatar_url = avatar_url;
    if (cover_url !== undefined) updates.cover_url = cover_url;
    if (is_published !== undefined) updates.is_published = is_published;
    if (template !== undefined) updates.template = template;
    if (social_links !== undefined) updates.social_links = typeof social_links === 'string' ? social_links : JSON.stringify(social_links);
    if (theme !== undefined) updates.theme = typeof theme === 'string' ? theme : JSON.stringify(theme);
    if (slug !== undefined) updates.slug = slugify(slug);
    if (metadata !== undefined) updates.metadata = typeof metadata === 'string' ? metadata : JSON.stringify(metadata);

    const { data, error } = await supabase
      .from('gatekeeper_profiles')
      .update(updates)
      .eq('owner_id', req.user.id)
      .select('*');

    if (error || !data || data.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    res.json({ profile: data[0] });
  } catch (err) {
    console.error('Gatekeeper update error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// POST /api/gatekeeper/blocks
router.post('/blocks', authMiddleware, async (req, res) => {
  try {
    const { block_type = 'text', title, content, media_url, layout, sort_order, is_visible = true } = req.body;

    const { data: profile } = await supabase
      .from('gatekeeper_profiles')
      .select('id')
      .eq('owner_id', req.user.id)
      .maybeSingle();

    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    const order = sort_order ?? 0;
    const { data, error } = await supabase
      .from('gatekeeper_blocks')
      .insert({
        profile_id: profile.id,
        block_type,
        title: title ?? null,
        content: content ?? null,
        media_url: media_url ?? null,
        layout: layout ? (typeof layout === 'string' ? layout : JSON.stringify(layout)) : '{}',
        sort_order: order,
        is_visible,
      })
      .select('*')
      .single();

    if (error) {
      console.error('Create block error:', error);
      return res.status(500).json({ error: 'Failed to create block' });
    }
    res.status(201).json({ block: data });
  } catch (err) {
    console.error('Create block error:', err);
    res.status(500).json({ error: 'Failed to create block' });
  }
});

// PUT /api/gatekeeper/blocks/:id
router.put('/blocks/:id', authMiddleware, async (req, res) => {
  try {
    const { title, content, media_url, layout, sort_order, is_visible, block_type } = req.body;

    const { data: profile } = await supabase
      .from('gatekeeper_profiles')
      .select('id')
      .eq('owner_id', req.user.id)
      .maybeSingle();

    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    const updates = {};
    if (block_type !== undefined) updates.block_type = block_type;
    if (title !== undefined) updates.title = title;
    if (content !== undefined) updates.content = content;
    if (media_url !== undefined) updates.media_url = media_url;
    if (layout !== undefined) updates.layout = typeof layout === 'string' ? layout : JSON.stringify(layout);
    if (sort_order !== undefined) updates.sort_order = sort_order;
    if (is_visible !== undefined) updates.is_visible = is_visible;

    const { data, error } = await supabase
      .from('gatekeeper_blocks')
      .update(updates)
      .eq('id', req.params.id)
      .eq('profile_id', profile.id)
      .select('*');

    if (error || !data || data.length === 0) {
      return res.status(404).json({ error: 'Block not found' });
    }
    res.json({ block: data[0] });
  } catch (err) {
    console.error('Update block error:', err);
    res.status(500).json({ error: 'Failed to update block' });
  }
});

// DELETE /api/gatekeeper/blocks/:id
router.delete('/blocks/:id', authMiddleware, async (req, res) => {
  try {
    const { data: profile } = await supabase
      .from('gatekeeper_profiles')
      .select('id')
      .eq('owner_id', req.user.id)
      .maybeSingle();

    if (!profile) return res.status(404).json({ error: 'Block not found' });

    const { data, error } = await supabase
      .from('gatekeeper_blocks')
      .delete()
      .eq('id', req.params.id)
      .eq('profile_id', profile.id)
      .select('id');

    if (error || !data || data.length === 0) {
      return res.status(404).json({ error: 'Block not found' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete block' });
  }
});

// GET /api/gatekeeper/subscription
router.get('/subscription', authMiddleware, async (req, res) => {
  try {
    const { data } = await supabase
      .from('gatekeeper_subscriptions')
      .select('*')
      .eq('owner_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    res.json({ subscription: data || { tier: 'free', status: 'active', price_cents: 0 } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load subscription' });
  }
});

// PUT /api/gatekeeper/subscription
router.put('/subscription', authMiddleware, async (req, res) => {
  try {
    const { tier } = req.body;
    if (!TIER_PRICES.hasOwnProperty(tier)) return res.status(400).json({ error: 'Invalid tier' });

    const priceCents = TIER_PRICES[tier];

    const { data: existing } = await supabase
      .from('gatekeeper_subscriptions')
      .select('*')
      .eq('owner_id', req.user.id)
      .maybeSingle();

    let subscription;
    if (existing) {
      const { data } = await supabase
        .from('gatekeeper_subscriptions')
        .update({ tier, price_cents: priceCents, status: 'active' })
        .eq('id', existing.id)
        .select('*')
        .single();
      subscription = data;
    } else {
      const { data } = await supabase
        .from('gatekeeper_subscriptions')
        .insert({ owner_id: req.user.id, tier, price_cents: priceCents, status: 'active' })
        .select('*')
        .single();
      subscription = data;
    }

    res.json({ subscription });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update subscription' });
  }
});

// GET /api/gatekeeper/messages
router.get('/messages', authMiddleware, async (req, res) => {
  try {
    const { data: profile } = await supabase
      .from('gatekeeper_profiles')
      .select('id')
      .eq('owner_id', req.user.id)
      .maybeSingle();

    if (!profile) return res.json({ messages: [] });

    const { data } = await supabase
      .from('gatekeeper_messages')
      .select('*')
      .eq('profile_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(100);

    res.json({ messages: data || [] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load messages' });
  }
});

// PUT /api/gatekeeper/messages/:id/read
router.put('/messages/:id/read', authMiddleware, async (req, res) => {
  try {
    const { data: profile } = await supabase
      .from('gatekeeper_profiles')
      .select('id')
      .eq('owner_id', req.user.id)
      .maybeSingle();

    if (profile) {
      await supabase
        .from('gatekeeper_messages')
        .update({ is_read: true })
        .eq('id', req.params.id)
        .eq('profile_id', profile.id);
    }
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed' });
  }
});

// DELETE /api/gatekeeper/messages/:id
router.delete('/messages/:id', authMiddleware, async (req, res) => {
  try {
    const { data: profile } = await supabase
      .from('gatekeeper_profiles')
      .select('id')
      .eq('owner_id', req.user.id)
      .maybeSingle();

    if (profile) {
      await supabase
        .from('gatekeeper_messages')
        .delete()
        .eq('id', req.params.id)
        .eq('profile_id', profile.id);
    }
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed' });
  }
});

// POST /api/gatekeeper/messages/:id/reply — owner replies to a client message
router.post('/messages/:id/reply', authMiddleware, async (req, res) => {
  try {
    const { reply_text } = req.body;
    if (!reply_text || !reply_text.trim()) {
      return res.status(400).json({ error: 'Reply text is required' });
    }

    const { data: profile } = await supabase
      .from('gatekeeper_profiles')
      .select('id')
      .eq('owner_id', req.user.id)
      .maybeSingle();

    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    const { data: msg } = await supabase
      .from('gatekeeper_messages')
      .select('id, replies')
      .eq('id', req.params.id)
      .eq('profile_id', profile.id)
      .maybeSingle();

    if (!msg) return res.status(404).json({ error: 'Message not found' });

    let replies = [];
    if (msg.replies) {
      try { replies = typeof msg.replies === 'string' ? JSON.parse(msg.replies) : msg.replies; } catch { replies = []; }
    }
    replies.push({ text: String(reply_text).slice(0, 5000), sent_at: new Date().toISOString() });

    const { data: updated, error } = await supabase
      .from('gatekeeper_messages')
      .update({ replies: JSON.stringify(replies), is_read: true })
      .eq('id', req.params.id)
      .select('*')
      .single();

    if (error) throw error;
    res.json({ message: updated });
  } catch (err) {
    console.error('Reply error:', err);
    res.status(500).json({ error: 'Failed to send reply' });
  }
});

// POST /api/gatekeeper/site/:slug/message — public, no auth
router.post('/site/:slug/message', async (req, res) => {
  try {
    const { sender_name, sender_email, message, page } = req.body;
    if (!sender_name || !sender_email || !message) {
      return res.status(400).json({ error: 'Name, email, and message are required' });
    }

    const { data: profile } = await supabase
      .from('gatekeeper_profiles')
      .select('id')
      .eq('slug', req.params.slug)
      .eq('is_published', true)
      .maybeSingle();

    if (!profile) return res.status(404).json({ error: 'Site not found' });

    await supabase.from('gatekeeper_messages').insert({
      profile_id: profile.id,
      sender_name: String(sender_name).slice(0, 255),
      sender_email: String(sender_email).slice(0, 255),
      message: String(message).slice(0, 5000),
      page: page || 'contact',
    });

    res.status(201).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// POST /api/gatekeeper/media — upload media for a block
router.post('/media', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const { data: profile } = await supabase
      .from('gatekeeper_profiles')
      .select('id')
      .eq('owner_id', req.user.id)
      .maybeSingle();

    if (!profile) return res.status(404).json({ error: 'No profile found' });

    const base64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    const mediaType = req.file.mimetype.startsWith('video') ? 'video' : 'image';

    const { data, error } = await supabase
      .from('gatekeeper_media')
      .insert({
        profile_id: profile.id,
        media_type: mediaType,
        url: base64,
        filename: req.file.originalname,
      })
      .select('*')
      .single();

    if (error) throw error;
    res.status(201).json({ media: data, url: base64 });
  } catch (err) {
    res.status(500).json({ error: 'Media upload failed' });
  }
});

// GET /api/gatekeeper/site/:slug — public profile (no auth)
router.get('/site/:slug', async (req, res) => {
  try {
    const { data: profile } = await supabase
      .from('gatekeeper_profiles')
      .select('*')
      .eq('slug', req.params.slug)
      .eq('is_published', true)
      .maybeSingle();

    if (!profile) return res.status(404).json({ error: 'Site not found' });

    const { data: blocks } = await supabase
      .from('gatekeeper_blocks')
      .select('*')
      .eq('profile_id', profile.id)
      .eq('is_visible', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    res.json({
      profile: {
        ...profile,
        social_links: parseJsonField(profile.social_links, {}),
        theme: parseJsonField(profile.theme, {}),
      },
      blocks: (blocks || []).map((b) => ({ ...b, layout: parseJsonField(b.layout, {}) })),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load site' });
  }
});

export default router;
