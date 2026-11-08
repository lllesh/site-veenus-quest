// cartas e coleções: ler é livre (o site já é fechado pela senha); escrever só com a chave. nada se apaga: arquivar esconde.
const URL_BASE = process.env.SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE;
const KEY = process.env.EDIT_KEY;
const CAMPOS = ['titulo', 'texto', 'imagem', 'video', 'colecao_id', 'ordem', 'arquivado'];

async function sb(path, init = {}) {
  const r = await fetch(`${URL_BASE}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json', 'Accept-Profile': 'veenus', 'Content-Profile': 'veenus', ...(init.headers || {}) },
  });
  const t = await r.text();
  if (!r.ok) throw Object.assign(new Error(t), { status: r.status });
  return { dados: t ? JSON.parse(t) : null, total: r.headers.get('content-range') };
}
async function body(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const c = []; for await (const x of req) c.push(x);
  return JSON.parse(Buffer.concat(c).toString() || '{}');
}
const uuid = v => /^[0-9a-f-]{36}$/i.test(String(v || ''));
const limpa = (o) => { const x = {}; CAMPOS.forEach(k => { if (o[k] !== undefined) x[k] = o[k] }); if (x.titulo != null) x.titulo = String(x.titulo).slice(0, 500); if (x.texto != null) x.texto = String(x.texto).slice(0, 200000); if (x.colecao_id !== undefined && !uuid(x.colecao_id)) delete x.colecao_id; x.updated_at = new Date().toISOString(); return x };

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method === 'GET') {
      const q = req.query;
      if (q.colecoes !== undefined) {
        const { dados } = await sb('colecoes?select=id,nome,ordem,arquivado&order=ordem.asc,created_at.asc');
        const cont = await Promise.all(dados.map(c => sb(`cartas?select=id&colecao_id=eq.${c.id}&arquivado=eq.false&limit=1`, { headers: { Prefer: 'count=exact' } }).then(r => +(String(r.total || '').split('/')[1] || 0))));
        return res.json(dados.map((c, i) => ({ ...c, total: cont[i] })));
      }
      if (q.numero) {
        const n = parseInt(q.numero, 10); if (!n) return res.status(400).json({ error: 'número inválido' });
        const { dados } = await sb(`cartas?select=*&numero=eq.${n}`);
        const c = dados[0]; if (!c) return res.status(404).json({ error: 'carta não encontrada' });
        const col = c.colecao_id ? (await sb(`colecoes?select=id,nome&id=eq.${c.colecao_id}`)).dados[0] : null;
        const filtro = c.colecao_id ? `colecao_id=eq.${c.colecao_id}` : 'colecao_id=is.null';
        const ant = (await sb(`cartas?select=numero&${filtro}&arquivado=eq.false&ordem=lt.${c.ordem}&order=ordem.desc&limit=1`)).dados[0];
        const prox = (await sb(`cartas?select=numero&${filtro}&arquivado=eq.false&ordem=gt.${c.ordem}&order=ordem.asc&limit=1`)).dados[0];
        return res.json({ carta: c, colecao: col, anterior: ant ? ant.numero : null, proxima: prox ? prox.numero : null });
      }
      const lim = Math.min(200, parseInt(q.limit, 10) || 60), off = Math.max(0, parseInt(q.offset, 10) || 0);
      let f = `cartas?select=id,numero,colecao_id,ordem,titulo,texto,imagem,video,arquivado&order=ordem.asc,numero.asc&limit=${lim}&offset=${off}`;
      if (uuid(q.colecao)) f += `&colecao_id=eq.${q.colecao}`;
      f += `&arquivado=eq.${q.arquivadas === '1' ? 'true' : 'false'}`;
      if (q.busca) { const b = encodeURIComponent('*' + String(q.busca).replace(/[*,()]/g, ' ').slice(0, 80) + '*'); f += `&or=(titulo.ilike.${b},texto.ilike.${b})` }
      const { dados, total } = await sb(f, { headers: { Prefer: 'count=exact' } });
      return res.json({ cartas: dados, total: +(String(total || '').split('/')[1] || 0) });
    }
    if (req.method === 'POST') {
      if (!KEY || req.headers['x-edit-key'] !== KEY) return res.status(401).json({ error: 'chave inválida' });
      const b = await body(req);
      if (b.acao === 'salvar' && uuid(b.id)) {
        const { dados } = await sb(`cartas?id=eq.${b.id}`, { method: 'PATCH', body: JSON.stringify(limpa(b.carta || {})), headers: { Prefer: 'return=representation' } });
        return res.json({ ok: true, carta: dados[0] });
      }
      if (b.acao === 'nova') {
        const col = uuid(b.colecao_id) ? b.colecao_id : null;
        const ult = (await sb(`cartas?select=ordem&${col ? `colecao_id=eq.${col}` : 'colecao_id=is.null'}&order=ordem.desc&limit=1`)).dados[0];
        const nova = limpa({ titulo: '', texto: '', imagem: '', video: '', ...(b.carta || {}), colecao_id: col, ordem: ult ? ult.ordem + 1 : 0 });
        const { dados } = await sb('cartas', { method: 'POST', body: JSON.stringify(nova), headers: { Prefer: 'return=representation' } });
        return res.json({ ok: true, carta: dados[0] });
      }
      if (b.acao === 'colecao_nova') {
        const ult = (await sb('colecoes?select=ordem&order=ordem.desc&limit=1')).dados[0];
        const { dados } = await sb('colecoes', { method: 'POST', body: JSON.stringify({ nome: String(b.nome || 'nova coleção').slice(0, 200), ordem: ult ? ult.ordem + 1 : 0 }), headers: { Prefer: 'return=representation' } });
        return res.json({ ok: true, colecao: dados[0] });
      }
      if (b.acao === 'colecao_salvar' && uuid(b.id)) {
        const x = { updated_at: new Date().toISOString() };
        if (b.nome != null) x.nome = String(b.nome).slice(0, 200);
        if (b.arquivado != null) x.arquivado = !!b.arquivado;
        if (b.ordem != null) x.ordem = +b.ordem;
        const { dados } = await sb(`colecoes?id=eq.${b.id}`, { method: 'PATCH', body: JSON.stringify(x), headers: { Prefer: 'return=representation' } });
        return res.json({ ok: true, colecao: dados[0] });
      }
      return res.status(400).json({ error: 'pedido inválido' });
    }
    res.status(405).end();
  } catch (e) {
    res.status(e.status || 500).json({ error: String(e.message || e).slice(0, 300) });
  }
};
