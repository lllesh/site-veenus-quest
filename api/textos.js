// textos, fotos e vídeos do site: todo mundo lê; só com a chave escreve. cada gravação também vai pro histórico (nada se perde)
const URL_BASE = process.env.SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE;
const KEY = process.env.EDIT_KEY;
const PAGINA = 'swiss-reduce-1';

async function sb(path, init = {}) {
  const r = await fetch(`${URL_BASE}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json', 'Accept-Profile': 'veenus', 'Content-Profile': 'veenus', ...(init.headers || {}) },
  });
  const t = await r.text();
  if (!r.ok) throw Object.assign(new Error(t), { status: r.status });
  return t ? JSON.parse(t) : null;
}
async function body(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const c = []; for await (const x of req) c.push(x);
  return JSON.parse(Buffer.concat(c).toString() || '{}');
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method === 'GET') {
      if (req.query.check !== undefined) return res.json({ ok: !!KEY && req.headers['x-edit-key'] === KEY });
      return res.json(await sb(`textos?select=chave,html&pagina=eq.${PAGINA}`));
    }
    if (req.method === 'POST') {
      if (!KEY || req.headers['x-edit-key'] !== KEY) return res.status(401).json({ error: 'chave inválida' });
      const b = await body(req);
      const lista = (Array.isArray(b.blocos) ? b.blocos : [b])
        .filter(x => x && typeof x.chave === 'string' && typeof x.html === 'string')
        .map(x => ({ pagina: PAGINA, chave: x.chave.slice(0, 200), html: x.html.slice(0, 100000), updated_at: new Date().toISOString() }));
      if (!lista.length) return res.status(400).json({ error: 'nada pra salvar' });
      await sb('historico', { method: 'POST', body: JSON.stringify(lista.map(({ updated_at, ...x }) => x)), headers: { Prefer: 'return=minimal' } });
      await sb('textos?on_conflict=pagina,chave', { method: 'POST', body: JSON.stringify(lista), headers: { Prefer: 'resolution=merge-duplicates,return=minimal' } });
      return res.json({ ok: true, salvos: lista.length });
    }
    res.status(405).end();
  } catch (e) {
    res.status(e.status || 500).json({ error: String(e.message || e).slice(0, 300) });
  }
};
