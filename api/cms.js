const fs = require('fs');
const path = require('path');
module.exports = (req, res) => {
  const p = String(req.query.p || '').replace(/\.\.+/g, '');
  const file = path.join(__dirname, '_cms', p);
  let buf;
  try { buf = fs.readFileSync(file); } catch { res.statusCode = 404; return res.end('not found'); }
  const q = String(req.query.range || (req.headers.range || '').replace(/^bytes=/, ''));
  let out = buf;
  if (q) {
    out = Buffer.concat(q.split(',').map(r => {
      const [a, b] = r.trim().split('-');
      const start = +a || 0;
      const end = b !== undefined && b !== '' ? Math.min(+b, buf.length - 1) : buf.length - 1;
      return buf.subarray(start, end + 1);
    }));
  }
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.end(out);
};
