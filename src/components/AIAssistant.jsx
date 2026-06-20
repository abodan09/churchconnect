'use client';

import { useState, useRef, useEffect } from 'react';
import { Bot, X, Send, Loader2, ChevronDown, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useApp } from '@/components/providers';

const AGENTS = [
  { id: 'pastoral', label: 'Pastoral', description: 'Members, care & general questions' },
  { id: 'finance', label: 'Finance', description: 'Giving trends & expenditure insights' },
  { id: 'events', label: 'Events', description: 'Announcements & scheduling' },
  { id: 'communications', label: 'Communications', description: 'Drafts & messages' },
];

function MessageBubble({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      {!isUser && (
        <div className="mr-2 mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary">
          <Sparkles className="h-3.5 w-3.5 text-primary-foreground" />
        </div>
      )}
      <div
        className={`max-w-[82%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
          isUser ? 'rounded-br-sm bg-primary text-primary-foreground' : 'rounded-bl-sm bg-muted text-foreground'
        }`}
      >
        {msg.content}
        {msg.streaming && <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse rounded-sm bg-current" />}
      </div>
    </div>
  );
}

export function AIAssistant() {
  const { settings } = useApp();
  const [open, setOpen] = useState(false);
  const [agentType, setAgentType] = useState('pastoral');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showAgentPicker, setShowAgentPicker] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  const selectedAgent = AGENTS.find((a) => a.id === agentType);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (open && messages.length === 0) {
      const churchName = settings?.church_name || 'your church';
      setMessages([
        {
          role: 'assistant',
          content: `Hi! I'm your ChurchConnect AI assistant for ${churchName}. I'm in **${selectedAgent.label}** mode — ${selectedAgent.description}.\n\nHow can I help?`,
        },
      ]);
    }
    if (open) inputRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function buildContext() {
    const parts = [];
    if (settings?.church_name) parts.push(`Church: ${settings.church_name}`);
    if (settings?.currency_symbol) parts.push(`Currency: ${settings.currency_symbol}`);
    if (settings?.language) parts.push(`Language: ${settings.language}`);
    return parts.join('\n');
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;
    const updated = [...messages, { role: 'user', content: text }];
    setMessages([...updated, { role: 'assistant', content: '', streaming: true }]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updated, agentType, context: buildContext() }),
      });
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let acc = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value, { stream: true }).split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6);
          if (payload === '[DONE]') break;
          try {
            const { text: t, error } = JSON.parse(payload);
            if (error) throw new Error(error);
            if (t) {
              acc += t;
              setMessages((prev) => {
                const next = [...prev];
                next[next.length - 1] = { role: 'assistant', content: acc, streaming: true };
                return next;
              });
            }
          } catch {
            /* skip malformed line */
          }
        }
      }
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = { role: 'assistant', content: acc, streaming: false };
        return next;
      });
    } catch (err) {
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          role: 'assistant',
          content: `Sorry, I hit an error: ${err.message}. Check that ANTHROPIC_API_KEY is configured.`,
          streaming: false,
        };
        return next;
      });
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function switchAgent(id) {
    setAgentType(id);
    setShowAgentPicker(false);
    setMessages([]);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-50 flex h-13 w-13 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95"
        style={{ width: 52, height: 52 }}
        aria-label="Open AI Assistant"
      >
        <Bot className="h-6 w-6" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex h-[520px] max-h-[calc(100vh-5rem)] w-[360px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
      <div className="flex flex-shrink-0 items-center justify-between border-b bg-primary px-4 py-3 text-primary-foreground">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          <span className="text-sm font-semibold">AI Assistant</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="relative">
            <button
              onClick={() => setShowAgentPicker((p) => !p)}
              className="flex items-center gap-1 rounded-full bg-primary-foreground/20 px-2.5 py-1 text-xs transition-colors hover:bg-primary-foreground/30"
            >
              {selectedAgent.label}
              <ChevronDown className="h-3 w-3" />
            </button>
            {showAgentPicker && (
              <div className="absolute right-0 top-full z-10 mt-1 w-56 overflow-hidden rounded-xl border border-border bg-popover shadow-xl">
                {AGENTS.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => switchAgent(a.id)}
                    className={`w-full px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted ${
                      a.id === agentType ? 'bg-muted font-medium' : ''
                    }`}
                  >
                    <div className="font-medium text-foreground">{a.label}</div>
                    <div className="text-xs text-muted-foreground">{a.description}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => setOpen(false)} className="ml-1 rounded-lg p-1 transition-colors hover:bg-primary-foreground/20" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {messages.map((msg, i) => (
          <MessageBubble key={i} msg={msg} />
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="flex flex-shrink-0 items-end gap-2 border-t px-3 py-3">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Ask the ${selectedAgent.label} agent…`}
          rows={1}
          disabled={loading}
          className="max-h-28 flex-1 resize-none overflow-y-auto rounded-xl border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          style={{ minHeight: 40 }}
        />
        <Button size="icon" className="h-10 w-10 flex-shrink-0 rounded-xl" onClick={sendMessage} disabled={loading || !input.trim()} aria-label="Send">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
