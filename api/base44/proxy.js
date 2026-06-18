// Proxies all Base44 API calls server-side to avoid CORS restrictions
// when the app is deployed outside of Base44's hosted environment.

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-App-Id,X-Requested-With');
    return res.status(204).end();
  }

  const base44BaseUrl = process.env.BASE44_API_URL || 'https://api.base44.app';

  // Extract the path after /api/base44/
  const { url } = req;
  const pathMatch = url.match(/\/api\/base44\/(.*)/);
  const upstreamPath = pathMatch ? pathMatch[1] : '';

  const upstreamUrl = `${base44BaseUrl}/${upstreamPath}`;

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

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(upstream.status);

    const contentType = upstream.headers.get('content-type') || 'application/json';
    res.setHeader('Content-Type', contentType);
    res.end(data);
  } catch (err) {
    console.error('Base44 proxy error:', err);
    res.status(502).json({ error: 'Bad gateway', message: err.message });
  }
}
