// devolve um endereço de envio direto pro Supabase Storage (bucket swiss-reduce-1), pra foto ou vídeo de qualquer tamanho até 50 MB
const URL_BASE = process.env.SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE;
const KEY = process.env.EDIT_KEY;
const BUCKET = 'swiss-reduce-1';
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).end();
  if (!KEY || req.headers['x-edit-key'] !== KEY) return res.status(401).json({ error: 'chave inválida' });
  try {
    const ext = String(req.query.ext || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'bin';
    const pasta = req.query.tipo === 'video' ? 'videos' : 'fotos';
    const nome = `${pasta}/${new Date().toISOString().slice(0, 10)}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const r = await fetch(`${URL_BASE}/storage/v1/object/upload/sign/${BUCKET}/${nome}`, { method: 'POST', headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } });
    const j = await r.json();
    if (!r.ok || !j.url) return res.status(500).json({ error: JSON.stringify(j).slice(0, 200) });
    res.json({ envio: `${URL_BASE}/storage/v1${j.url}`, url: `${URL_BASE}/storage/v1/object/public/${BUCKET}/${nome}` });
  } catch (e) { res.status(500).json({ error: String(e.message || e).slice(0, 200) }) }
};
