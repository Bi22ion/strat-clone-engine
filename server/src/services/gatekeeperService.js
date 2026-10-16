import { supabase } from '../db.js';

const DEFAULT_BLOCKS = [
  { block_type: 'hero', title: 'Trade with Confidence', content: 'I share my live setups, classes, and reflections so you can learn while I sleep.', sort_order: 0 },
  { block_type: 'stats', title: 'Track Record', content: 'Win rate and risk/reward pulled from my Strat-Clone models.', sort_order: 1 },
  { block_type: 'video', title: 'Latest Class Replay', content: 'Catch the session you missed — time-zone friendly replays.', sort_order: 2 },
  { block_type: 'cta', title: 'Join My Next Live Session', content: 'Follow along and ask questions in real time.', sort_order: 3 },
];

export async function ensureGatekeeperSchema() {
  // Schema is managed via Supabase migrations - this is a no-op now
  // Tables are created by the migration tool
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

  // Check if profile already exists
  const { data: existingProfile } = await supabase
    .from('gatekeeper_profiles')
    .select('*')
    .eq('owner_id', userId)
    .maybeSingle();

  let profile = existingProfile;

  if (!profile) {
    const { data: newProfile, error } = await supabase
      .from('gatekeeper_profiles')
      .insert({
        owner_id: userId,
        slug,
        display_name: name,
        tagline: 'Sharing my edge with the world.',
        bio: `Welcome to ${name}'s trading hub.`,
        is_published: false,
        template: 'gift-default',
        theme: JSON.stringify({ primary_color: '#10b981', font: 'inter', layout: 'stacked' }),
      })
      .select('*')
      .single();

    if (error) {
      console.error('Seed profile error:', error);
      return null;
    }
    profile = newProfile;
  }

  if (!profile) return null;

  // Seed role
  await supabase
    .from('gatekeeper_roles')
    .upsert({ user_id: userId, role: 'trader', approval_status: 'approved' }, { onConflict: 'user_id' })
    .select();

  // Seed admin status
  await supabase
    .from('gatekeeper_admin_status')
    .upsert({ user_id: userId, email: email || '', status: 'approved' }, { onConflict: 'user_id' })
    .select();

  // Seed subscription
  const { data: existingSub } = await supabase
    .from('gatekeeper_subscriptions')
    .select('id')
    .eq('owner_id', userId)
    .maybeSingle();

  if (!existingSub) {
    await supabase
      .from('gatekeeper_subscriptions')
      .insert({
        owner_id: userId,
        tier: 'free',
        status: 'active',
        price_cents: 0,
      });
  }

  // Seed default blocks
  const { data: existingBlocks } = await supabase
    .from('gatekeeper_blocks')
    .select('id', { count: 'exact', head: true })
    .eq('profile_id', profile.id);

  if ((existingBlocks?.length || 0) === 0) {
    for (const block of DEFAULT_BLOCKS) {
      await supabase.from('gatekeeper_blocks').insert({
        profile_id: profile.id,
        block_type: block.block_type,
        title: block.title,
        content: block.content,
        sort_order: block.sort_order,
        is_visible: true,
      });
    }
  }

  return profile;
}

export async function getProfileWithBlocks(userId) {
  const { data: profile, error } = await supabase
    .from('gatekeeper_profiles')
    .select('*')
    .eq('owner_id', userId)
    .maybeSingle();

  if (!profile) return null;

  const { data: blocks } = await supabase
    .from('gatekeeper_blocks')
    .select('*')
    .eq('profile_id', profile.id)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  return { profile, blocks: blocks || [] };
}
