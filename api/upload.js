import { put } from '@vercel/blob';

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);
    const contentType = req.headers['content-type'] || 'application/octet-stream';
    const filename = req.headers['x-filename'] || `upload-${Date.now()}`;
    const blob = await put(filename, buffer, { access: 'public', contentType });
    res.status(200).json({ file_url: blob.url });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
}
