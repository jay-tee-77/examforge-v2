// api/auth.js — handles signup, login, get user
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action, email, password, name } = req.body;

  if (!action || !email) return res.status(400).json({ error: 'Missing required fields' });

  const emailLower = email.trim().toLowerCase();

  // ── SIGN UP ──
  if (action === 'signup') {
    if (!name || !password) return res.status(400).json({ error: 'Name and password required' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    // Check if user exists
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', emailLower)
      .single();

    if (existing) return res.status(409).json({ error: 'An account with this email already exists. Please sign in.' });

    // Hash password (simple — for production use bcrypt)
    const encoder = new TextEncoder();
    const data = encoder.encode(password + process.env.PASSWORD_SALT);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const passwordHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    const { data: user, error } = await supabase
      .from('users')
      .insert([{ email: emailLower, name: name.trim(), password_hash: passwordHash, joined_at: new Date().toISOString() }])
      .select('id, email, name, joined_at')
      .single();

    if (error) return res.status(500).json({ error: 'Could not create account: ' + error.message });

    // Log the signup visit
    await supabase.from('visits').insert([{ user_id: user.id, email: emailLower, name: user.name, type: 'signup', created_at: new Date().toISOString() }]);

    return res.status(200).json({ user });
  }

  // ── SIGN IN ──
  if (action === 'signin') {
    if (!password) return res.status(400).json({ error: 'Password required' });

    const encoder = new TextEncoder();
    const data = encoder.encode(password + process.env.PASSWORD_SALT);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const passwordHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, name, joined_at')
      .eq('email', emailLower)
      .eq('password_hash', passwordHash)
      .single();

    if (error || !user) return res.status(401).json({ error: 'Incorrect email or password' });

    await supabase.from('visits').insert([{ user_id: user.id, email: emailLower, name: user.name, type: 'login', created_at: new Date().toISOString() }]);

    return res.status(200).json({ user });
  }

  return res.status(400).json({ error: 'Unknown action' });
}
