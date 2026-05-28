// api/history.js — get and manage session history
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'userId required' });

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('history')
      .select('id, course, created_at, guide')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ history: data || [] });
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'id required' });
    await supabase.from('history').delete().eq('id', id).eq('user_id', userId);
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
