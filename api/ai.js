// Anthropic Claude streaming endpoint.
// Receives { messages, agentType, context } from the frontend and streams back Claude's response.

import Anthropic from '@anthropic-ai/sdk';

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
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
  }

  const { messages = [], agentType = 'pastoral', context = '' } = req.body || {};

  const agent = CHURCH_AGENTS[agentType] || CHURCH_AGENTS.pastoral;

  const systemPrompt = context
    ? `${agent.system}\n\n## Current Church Data Context\n${context}`
    : agent.system;

  const client = new Anthropic({ apiKey });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

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
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
}
