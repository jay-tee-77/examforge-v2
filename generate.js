// api/generate.js — calls Gemini AI securely
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

  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) return res.status(500).json({ error: 'AI not configured on server.' });

  try {
    const { parts, course, inst, notes, userId } = req.body;
    if (!parts || !Array.isArray(parts)) return res.status(400).json({ error: 'Invalid request.' });

    const promptText = `You are an expert academic tutor. A student is preparing for their ${course || 'this course'} exam${inst ? ' at ' + inst : ''}.
${notes ? 'Student notes: ' + notes : ''}
The documents are their course materials and one past exam question paper.

Generate a COMPREHENSIVE master study guide for scoring 80-100%. Include ALL:

# EXAM FORMAT BREAKDOWN
Sections, marks, question types, time management tips.

# COMPLETE TOPIC-BY-TOPIC NOTES
Every major topic: clear definition, key concepts, examples, comparison tables.

# SECTION A PREP — Multiple Choice
Sample questions + correct answers. Flag tricky distinctions students confuse.

# SECTION B PREP — Fill in the Blanks
All key terms and fill-in-the-blank facts to memorise.

# SECTION C PREP — Essays
For each likely essay: definition paragraph + full model answer (4-6 paragraphs) + must-include bullet points.

# FINAL CHEAT SHEET
| Term / Question | Answer |
40+ rows. Use markdown throughout. Be thorough and exam-focused. Make it exceptional.`;

    const allParts = [...parts, { text: promptText }];

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: allParts }],
          generationConfig: { maxOutputTokens: 8192, temperature: 0.7 }
        })
      }
    );

    if (!geminiRes.ok) {
      const e = await geminiRes.json().catch(() => ({}));
      if (geminiRes.status === 429) return res.status(429).json({ error: 'AI is busy — please wait 30 seconds and try again.' });
      return res.status(geminiRes.status).json({ error: e.error?.message || 'AI error' });
    }

    const data = await geminiRes.json();
    const guide = data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('\n') || '';
    if (!guide.trim()) return res.status(500).json({ error: 'Empty response — please try again.' });

    // Save to history if user is logged in
    if (userId) {
      await supabase.from('history').insert([{
        user_id: userId,
        course: course || 'Unknown Course',
        guide,
        created_at: new Date().toISOString()
      }]);
    }

    return res.status(200).json({ guide });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
