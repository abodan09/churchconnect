import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { to, subject, body, from_name } = req.body;
  try {
    await resend.emails.send({
      from: `${from_name || 'ChurchConnect'} <no-reply@churchconnect.app>`,
      to,
      subject,
      html: body,
    });
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Email error:', err);
    res.status(500).json({ error: 'Email failed' });
  }
}
