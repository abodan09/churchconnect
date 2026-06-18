// Proxies all Base44 API calls server-side to avoid CORS restrictions
// when the app is deployed outside of Base44's hosted environment.

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map(o => o.trim());

function setCors(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Vary', 'Origin');
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    setCors(req, res);
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-App-Id,X-Requested-With');
    return res.status(204).end();
  }

  const base44BaseUrl = process.env.BASE44_API_URL || 'https://api.base44.app';

  // Forward the full original path (e.g. /api/apps/${appId}/entities/...)
  // to Base44 as-is — the SDK uses /api/apps/... and Base44 serves the same paths.
  const upstreamUrl = `${base44BaseUrl}${req.url}`;

  const headers = {
    'Content-Type': 'application/json',
  };

  if (req.headers['authorization']) headers['Authorization'] = req.headers['authorization'];
  if (req.headers['x-app-id']) headers['X-App-Id'] = req.headers['x-app-id'];

  try {
    const fetchOptions = {
      method: req.method,
      headers,
    };

    if (!['GET', 'HEAD'].includes(req.method)) {
      fetchOptions.body = JSON.stringify(req.body);
    }

    const upstream = await fetch(upstreamUrl, fetchOptions);
    const data = await upstream.text();

    setCors(req, res);
    res.status(upstream.status);

    const contentType = upstream.headers.get('content-type') || 'application/json';
    res.setHeader('Content-Type', contentType);
    res.end(data);
  } catch (err) {
    console.error('Base44 proxy error:', err);
    res.status(502).json({ error: 'Bad gateway' });
  }
}
