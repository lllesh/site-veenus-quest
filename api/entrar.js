// confere a senha e deixa o navegador entrar no livro.ink por um ano
const crypto = require('crypto');
const KEY = process.env.EDIT_KEY;
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).end();
  const v = String(req.headers['x-edit-key'] || '');
  if (!KEY || v !== KEY) return res.status(401).json({ ok: false });
  const selo = crypto.createHash('sha256').update('livro.ink:' + KEY).digest('hex');
  res.setHeader('Set-Cookie', `livro=${selo}; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Lax`);
  res.json({ ok: true });
};
