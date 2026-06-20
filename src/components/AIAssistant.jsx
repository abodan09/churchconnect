import { useState, useRef, useEffect } from 'react';
import { Bot, X, Send, Loader2, ChevronDown, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useChurchSettings } from '@/lib/ChurchSettingsContext';

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
        <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center mr-2 flex-shrink-0 mt-0.5">
          <Sparkles className="w-3.5 h-3.5 text-primary-foreground" />
        </div>
      )}
      <div
        className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? 'bg-primary text-primary-foreground rounded-br-sm'
            : 'bg-muted text-foreground rounded-bl-sm'
        }`}
      >
        {msg.content}
        {msg.streaming && (
          <span className="inline-block w-1.5 h-4 bg-current ml-0.5 animate-pulse rounded-sm" />
        )}
      </div>
    </div>
  );
}

export default function AIAssistant() {
  const [open, setOpen] = useState(false);
  const [agentType, setAgentType] = useState('pastoral');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showAgentPicker, setShowAgentPicker] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const { settings } = useChurchSettings();

  const selectedAgent = AGENTS.find(a => a.id === agentType);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (open && messages.length === 0) {
      const churchName = settings?.church_name || 'your church';
      setMessages([{
        role: 'assistant',
        content: `Hi! I'm your ChurchConnect AI assistant for ${churchName}. I'm currently in **${selectedAgent.label}** mode — ${selectedAgent.description}.\n\nHow can I help you today?`,
      }]);
    }
  }, [open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const buildContext = () => {
    const parts = [];
    if (settings?.church_name) parts.push(`Church: ${settings.church_name}`);
    if (settings?.currency_symbol) parts.push(`Currency: ${settings.currency_symbol}`);
    if (settings?.language) parts.push(`Language: ${settings.language}`);
    return parts.join('\n');
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg = { role: 'user', content: text };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setLoading(true);

    const assistantMsg = { role: 'assistant', content: '', streaming: true };
    setMessages(prev => [...prev, assistantMsg]);

    try {
      const token = await window.Clerk?.session?.getToken().catch(() => null);
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          messages: updatedMessages,
          agentType,
          context: buildContext(),
        }),
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6);
          if (payload === '[DONE]') break;
          try {
            const { text, error } = JSON.parse(payload);
            if (error) throw new Error(error);
            if (text) {
              accumulated += text;
              setMessages(prev => {
                const next = [...prev];
                next[next.length - 1] = { role: 'assistant', content: accumulated, streaming: true };
                return next;
              });
            }
          } catch {
            // skip malformed SSE lines
          }
        }
      }

      setMessages(prev => {
        const next = [...prev];
        next[next.length - 1] = { role: 'assistant', content: accumulated, streaming: false };
        return next;
      });
    } catch (err) {
      setMessages(prev => {
        const next = [...prev];
        next[next.length - 1] = {
          role: 'assistant',
          content: `Sorry, I encountered an error: ${err.message}. Please check that the ANTHROPIC_API_KEY is configured.`,
          streaming: false,
        };
        return next;
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const switchAgent = (id) => {
    setAgentType(id);
    setShowAgentPicker(false);
    setMessages([]);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-50 w-13 h-13 rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-105 active:scale-95 transition-transform flex items-center justify-center"
        aria-label="Open AI Assistant"
        style={{ width: 52, height: 52 }}
      >
        <Bot className="w-6 h-6" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col w-[360px] max-w-[calc(100vw-2rem)] h-[520px] max-h-[calc(100vh-5rem)] rounded-2xl shadow-2xl border border-border bg-background overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-primary text-primary-foreground flex-shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4" />
          <span className="font-semibold text-sm">AI Assistant</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="relative">
            <button
              onClick={() => setShowAgentPicker(p => !p)}
              className="flex items-center gap-1 text-xs bg-primary-foreground/20 hover:bg-primary-foreground/30 rounded-full px-2.5 py-1 transition-colors"
            >
              {selectedAgent.label}
              <ChevronDown className="w-3 h-3" />
            </button>
            {showAgentPicker && (
              <div className="absolute right-0 top-full mt-1 w-56 bg-popover border border-border rounded-xl shadow-xl z-10 overflow-hidden">
                {AGENTS.map(a => (
                  <button
                    key={a.id}
                    onClick={() => switchAgent(a.id)}
                    className={`w-full text-left px-3 py-2.5 text-sm hover:bg-muted transition-colors ${
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
          <button
            onClick={() => setOpen(false)}
            className="p-1 hover:bg-primary-foreground/20 rounded-lg transition-colors ml-1"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
        {messages.map((msg, i) => (
          <MessageBubble key={i} msg={msg} />
        ))}
        {loading && messages[messages.length - 1]?.streaming === false && (
          <div className="flex items-center gap-2 text-muted-foreground text-xs pl-9">
            <Loader2 className="w-3 h-3 animate-spin" /> Thinking…
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex items-end gap-2 px-3 py-3 border-t flex-shrink-0">
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Ask the ${selectedAgent.label} agent…`}
          rows={1}
          className="flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 max-h-28 overflow-y-auto"
          style={{ minHeight: '40px' }}
          disabled={loading}
        />
        <Button
          size="icon"
          className="rounded-xl h-10 w-10 flex-shrink-0"
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          aria-label="Send"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
}
