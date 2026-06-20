// Anthropic Claude streaming endpoint.
// Receives { messages, agentType, context } from the frontend and streams back Claude's response.

import Anthropic from '@anthropic-ai/sdk';

function setCors(req, res) {
  const configured = process.env.ALLOWED_ORIGIN;
  if (!configured) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return;
  }
  const allowed = configured.split(',').map(o => o.trim());
  const origin = req.headers.origin;
  if (origin && allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
}

const CHURCH_AGENTS = {
  pastoral: {
    name: 'Pastoral Assistant',
    system: `You are a helpful Pastoral Assistant for ChurchConnect, a church management platform.
You have access to church member data, events, and giving records provided in the context.
Help staff answer questions about members, birthdays, attendance, and pastoral care needs.
Be warm, professional, and church-appropriate in tone. Keep responses concise and actionable.
When data is provided in context, use it to give specific answers. Do not make up member names or numbers.`,
  },
  finance: {
    name: 'Finance Tracker',
    system: `You are a Church Finance Tracker agent for ChurchConnect.
You specialize in analysing giving trends, flagging unusual expenditures, and summarising financial data.
Provide clear, concise financial insights using the data provided in context.
Format currency consistently. Highlight anomalies, growth trends, and areas needing attention.
Be professional and precise — this data involves real donor contributions.`,
  },
  events: {
    name: 'Event Coordinator',
    system: `You are a Church Event Coordinator agent for ChurchConnect.
You help plan events, draft announcements, suggest follow-up messaging, and check for scheduling conflicts.
Use the event data provided in context to give specific recommendations.
Write event announcements in a welcoming, community-focused tone suitable for a church bulletin or WhatsApp.`,
  },
  communications: {
    name: 'Communications Writer',
    system: `You are a Church Communications Writer for ChurchConnect.
You draft newsletters, bulletin copy, WhatsApp messages, emails, and social media posts for the church.
Use the church name and settings from context. Match the church's tone — professional yet warm and pastoral.
When asked to draft a message, provide a complete, ready-to-send draft.`,
  },
};

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    setCors(req, res);
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Service configuration error' });
  }

  const { messages = [], agentType = 'pastoral', context = '' } = req.body || {};

  if (!Array.isArray(messages) || messages.length > 50) {
    return res.status(400).json({ error: 'Invalid request' });
  }

  const agent = CHURCH_AGENTS[agentType] || CHURCH_AGENTS.pastoral;

  const systemPrompt = context
    ? `${agent.system}\n\n## Current Church Data Context\n${context}`
    : agent.system;

  const client = new Anthropic({ apiKey });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  setCors(req, res);

  try {
    const stream = client.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
        res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    console.error('Anthropic API error:', err);
    const status = err.status;
    const clientMessage = status === 429 ? 'Service temporarily unavailable. Please try again.' : 'An error occurred. Please try again.';
    res.write(`data: ${JSON.stringify({ error: clientMessage })}\n\n`);
    res.end();
  }
}
