// api/db.js — Supabase 티켓 CRUD
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if(req.method==='OPTIONS') return res.status(200).end();

  const token = req.headers.authorization?.replace('Bearer ','');
  if(!token) return res.status(401).json({error:'인증 필요'});

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if(authError || !user) return res.status(401).json({error:'유효하지 않은 토큰'});

  const uid = user.id;

  if(req.method==='GET'){
    const { data, error } = await supabase
      .from('tickets')
      .select('*')
      .eq('user_id', uid)
      .order('ts', { ascending: true });
    if(error) return res.status(500).json({error: error.message});
    return res.status(200).json(data);
  }

  if(req.method==='POST'){
    const ticket = req.body;
    const { error } = await supabase
      .from('tickets')
      .upsert({
        ...ticket,
        user_id: uid,
        cast: ticket.cast || ''
      });
    if(error) return res.status(500).json({error: error.message});
    return res.status(200).json({ok: true});
  }

  if(req.method==='DELETE'){
    const { id } = req.query;
    if(!id) return res.status(400).json({error:'id 필요'});
    const { error } = await supabase
      .from('tickets')
      .delete()
      .eq('id', id)
      .eq('user_id', uid);
    if(error) return res.status(500).json({error: error.message});
    return res.status(200).json({ok: true});
  }

  return res.status(405).json({error:'허용되지 않는 메서드'});
}
