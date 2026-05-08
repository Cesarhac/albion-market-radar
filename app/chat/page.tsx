'use client';

import React from 'react';
import { AlertTriangle, Clock3, MessageCircle, Send, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { RelativeTime } from '@/components/ui/RelativeTime';
import { useAuth } from '@/context/AuthContext';
import {
  type ChatChannel,
  type ChatMessage,
  filterFreshChatMessages,
  fetchChatMessages,
  isFreshChatMessage,
  reportChatMessage,
  sendChatMessage,
  subscribeToChatMessages,
} from '@/src/lib/supabase/database';
import { cn } from '@/lib/utils';

const CHANNELS: ChatChannel[] = ['Global', 'Américas', 'Europa', 'Mercado', 'Armas .4', 'Regear', 'Dúvidas'];
const MAX_MESSAGE_LENGTH = 300;
const MIN_SEND_INTERVAL_MS = 3000;

export default function ChatPage() {
  const { user } = useAuth();
  const [channel, setChannel] = React.useState<ChatChannel>('Global');
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [content, setContent] = React.useState('');
  const [errorMessage, setErrorMessage] = React.useState('');
  const [isLoaded, setIsLoaded] = React.useState(false);
  const [isSending, setIsSending] = React.useState(false);
  const lastSentAtRef = React.useRef(0);

  React.useEffect(() => {
    let isActive = true;

    async function loadMessages() {
      setIsLoaded(false);
      setErrorMessage('');

      try {
        const nextMessages = await fetchChatMessages(channel);

        if (!isActive) return;
        setMessages(nextMessages);
      } catch (error) {
        if (!isActive) return;
        setErrorMessage(error instanceof Error ? error.message : 'Não foi possível carregar o chat.');
      }

      if (isActive) setIsLoaded(true);
    }

    void loadMessages();

    const subscription = subscribeToChatMessages(channel, (message) => {
      if (!isFreshChatMessage(message) || message.status !== 'visible') return;

      setMessages((current) => {
        if (current.some((item) => item.id === message.id)) return current;
        return filterFreshChatMessages([...current, message]).slice(-100);
      });
    });

    return () => {
      isActive = false;
      if (subscription) void subscription.unsubscribe();
    };
  }, [channel]);

  React.useEffect(() => {
    let isActive = true;

    const refreshVisibleMessages = async () => {
      setMessages((current) => filterFreshChatMessages(current));

      try {
        const nextMessages = await fetchChatMessages(channel);

        if (isActive) setMessages(nextMessages);
      } catch {
        // Realtime remains the primary path; the periodic refresh is best effort.
      }
    };

    const intervalId = window.setInterval(() => {
      void refreshVisibleMessages();
    }, 30_000);

    return () => {
      isActive = false;
      window.clearInterval(intervalId);
    };
  }, [channel]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedContent = content.trim();

    if (!user) {
      setErrorMessage('Entre para enviar mensagens.');
      return;
    }

    if (!trimmedContent) return;

    if (trimmedContent.length > MAX_MESSAGE_LENGTH) {
      setErrorMessage(`A mensagem pode ter no máximo ${MAX_MESSAGE_LENGTH} caracteres.`);
      return;
    }

    if (Date.now() - lastSentAtRef.current < MIN_SEND_INTERVAL_MS) {
      setErrorMessage('Aguarde alguns segundos antes de enviar outra mensagem.');
      return;
    }

    setIsSending(true);
    setErrorMessage('');

    try {
      const message = await sendChatMessage({
        playerName: user.playerName,
        channel,
        content: trimmedContent,
      });

      lastSentAtRef.current = Date.now();
      setMessages((current) => {
        if (current.some((item) => item.id === message.id)) return current;
        return filterFreshChatMessages([...current, message]).slice(-100);
      });
      setContent('');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível enviar a mensagem.');
    } finally {
      setIsSending(false);
    }
  };

  const handleReport = async (message: ChatMessage) => {
    if (message.userId !== user?.id) {
      setErrorMessage('Denúncia preparada. A moderação será expandida em uma próxima etapa.');
      return;
    }

    try {
      await reportChatMessage(message.id);
      setMessages((current) => current.filter((item) => item.id !== message.id));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível denunciar a mensagem.');
    }
  };

  return (
    <div className="space-y-8">
      <header className="rounded-lg border border-border-subtle bg-[radial-gradient(circle_at_top_left,rgba(250,204,21,0.13),transparent_32%),linear-gradient(135deg,#18181b_0%,#09090b_78%)] p-5 shadow-2xl md:p-7">
        <Badge variant="primary" className="gap-2">
          <MessageCircle size={13} />
          Chat da comunidade
        </Badge>
        <h1 className="mt-3 text-3xl font-black text-white md:text-5xl">Chat</h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-400 md:text-base">
          Converse com outros jogadores usando seu nome do Albion. Mensagens somem após 5 minutos.
        </p>
      </header>

      <section className="rounded-lg border border-border-subtle bg-bg-card p-4 shadow-xl">
        <div className="grid gap-3 md:grid-cols-[auto_1fr] md:items-start">
          <div className="inline-flex rounded-md border border-brand-primary/20 bg-brand-primary/10 p-2 text-brand-primary">
            <Clock3 size={18} />
          </div>
          <div>
            <p className="text-sm font-black text-white">Mensagens somem após 5 minutos.</p>
            <p className="mt-1 text-sm leading-relaxed text-zinc-500">
              Não compartilhe senha, não compre/venda prata por dinheiro real, cuidado com golpes. O site não intermedia negociações.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[240px_1fr]">
        <aside className="rounded-lg border border-border-subtle bg-bg-card p-3 shadow-2xl">
          <p className="px-2 pb-2 text-[11px] font-bold uppercase tracking-wide text-zinc-500">Canais</p>
          <div className="grid gap-1">
            {CHANNELS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setChannel(item)}
                className={cn(
                  'rounded-lg px-3 py-3 text-left text-sm font-bold transition-colors',
                  channel === item
                    ? 'border border-brand-primary/25 bg-brand-primary/10 text-brand-primary'
                    : 'text-zinc-400 hover:bg-zinc-950 hover:text-white',
                )}
              >
                {item}
              </button>
            ))}
          </div>
        </aside>

        <div className="rounded-lg border border-border-subtle bg-bg-card shadow-2xl">
          <div className="border-b border-border-subtle p-5">
            <h2 className="text-xl font-black text-white">{channel}</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Logado como <span className="font-black text-brand-primary">{user?.playerName}</span>.
            </p>
          </div>

          {errorMessage ? (
            <div className="m-4 flex items-start gap-3 rounded-lg border border-status-warning/25 bg-status-warning/10 p-4 text-sm font-bold text-status-warning">
              <AlertTriangle className="mt-0.5 shrink-0" size={18} />
              {errorMessage}
            </div>
          ) : null}

          <div className="max-h-[56vh] min-h-80 space-y-3 overflow-y-auto p-4">
            {!isLoaded ? (
              <div className="rounded-lg border border-border-subtle bg-zinc-950 p-6 text-center text-sm font-bold text-zinc-500">
                Carregando mensagens...
              </div>
            ) : null}

            {isLoaded && messages.length === 0 ? (
              <div className="rounded-lg border border-border-subtle bg-zinc-950 p-6 text-center">
                <MessageCircle className="mx-auto text-zinc-700" size={32} />
                <h3 className="mt-3 font-black text-white">Nenhuma mensagem neste canal</h3>
                <p className="mt-1 text-sm text-zinc-500">Seja o primeiro a puxar conversa.</p>
              </div>
            ) : null}

            {messages.map((message) => (
              <article key={message.id} className="rounded-lg border border-border-subtle bg-zinc-950 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-black text-white">{message.playerName}</p>
                    <p className="text-xs font-bold text-zinc-600"><RelativeTime date={message.createdAt} /></p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleReport(message)}
                    className="text-left text-xs font-bold text-status-warning hover:text-status-danger sm:text-right"
                  >
                    Denunciar
                  </button>
                </div>
                <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-zinc-300">{message.content}</p>
              </article>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="border-t border-border-subtle p-4">
            <label className="space-y-2">
              <span className="field-label">Mensagem</span>
              <textarea
                value={content}
                onChange={(event) => setContent(event.target.value.slice(0, MAX_MESSAGE_LENGTH))}
                rows={3}
                maxLength={MAX_MESSAGE_LENGTH}
                placeholder="Escreva uma mensagem curta..."
                className="w-full rounded-lg border border-border-subtle bg-zinc-950 px-3 py-3 text-sm font-bold text-white outline-none placeholder:text-zinc-600 focus:border-brand-primary"
              />
            </label>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="flex items-start gap-2 text-xs font-bold leading-relaxed text-zinc-500">
                <ShieldAlert className="mt-0.5 shrink-0 text-status-warning" size={14} />
                Não compartilhe senha, não compre/venda prata por dinheiro real, cuidado com golpes. O site não intermedia negociações.
              </p>
              <button
                type="submit"
                disabled={isSending || !content.trim()}
                className="primary-button justify-center disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Send size={16} />
                Enviar
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
