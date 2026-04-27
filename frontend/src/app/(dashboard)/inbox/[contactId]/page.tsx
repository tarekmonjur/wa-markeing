'use client';

import { useState, useRef, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Send, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface MessageLog {
  id: string;
  direction: 'INBOUND' | 'OUTBOUND';
  body?: string;
  status: string;
  createdAt: string;
  sentAt?: string;
}

interface Session {
  id: string;
  status: string;
  displayName?: string;
  phoneNumber?: string;
}

export default function ConversationThreadPage() {
  const { contactId } = useParams<{ contactId: string }>();
  const queryClient = useQueryClient();
  const [messageText, setMessageText] = useState('');
  const [selectedSession, setSelectedSession] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const sessions = useQuery({
    queryKey: ['sessions'],
    queryFn: () => api.get<Session[]>('/whatsapp/sessions'),
  });

  const thread = useQuery({
    queryKey: ['inbox', contactId],
    queryFn: () => api.get<{ data: MessageLog[]; hasMore: boolean }>(`/inbox/${contactId}`),
    refetchInterval: 5000,
  });

  const sendMutation = useMutation({
    mutationFn: (body: string) =>
      api.post(`/inbox/${contactId}/send`, {
        sessionId: selectedSession,
        body,
      }),
    onSuccess: () => {
      setMessageText('');
      queryClient.invalidateQueries({ queryKey: ['inbox', contactId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread.data]);

  useEffect(() => {
    const connectedSession = (sessions.data as Session[] ?? []).find(
      (s) => s.status === 'CONNECTED',
    );
    if (connectedSession && !selectedSession) {
      setSelectedSession(connectedSession.id);
    }
  }, [sessions.data, selectedSession]);

  const messages = [...(thread.data?.data ?? [])].reverse();
  const sessionList = Array.isArray(sessions.data) ? sessions.data : [];

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex items-center gap-4 mb-4">
        <Link href="/inbox">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">Conversation</h1>
      </div>

      <Card className="flex-1 flex flex-col overflow-hidden">
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No messages yet
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  'flex',
                  msg.direction === 'OUTBOUND' ? 'justify-end' : 'justify-start',
                )}
              >
                <div
                  className={cn(
                    'max-w-[70%] rounded-lg px-4 py-2',
                    msg.direction === 'OUTBOUND'
                      ? 'bg-brand-500 text-white'
                      : 'bg-gray-100 text-gray-900',
                  )}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.body}</p>
                  <div
                    className={cn(
                      'text-xs mt-1',
                      msg.direction === 'OUTBOUND'
                        ? 'text-brand-100'
                        : 'text-gray-400',
                    )}
                  >
                    {new Date(msg.createdAt).toLocaleTimeString()}
                    {msg.direction === 'OUTBOUND' && (
                      <Badge
                        variant={msg.status === 'SENT' ? 'success' : msg.status === 'FAILED' ? 'destructive' : 'secondary'}
                        className="ml-2 text-[10px]"
                      >
                        {msg.status}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </CardContent>

        <div className="border-t p-4">
          <div className="flex gap-2 mb-2">
            <select
              value={selectedSession}
              onChange={(e) => setSelectedSession(e.target.value)}
              className="rounded border px-2 py-1 text-sm"
            >
              <option value="">Select session...</option>
              {sessionList
                .filter((s) => s.status === 'CONNECTED')
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.displayName ?? s.phoneNumber ?? s.id.slice(0, 8)}
                  </option>
                ))}
            </select>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (messageText.trim() && selectedSession) {
                sendMutation.mutate(messageText.trim());
              }
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 rounded-lg border px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <Button
              type="submit"
              disabled={!messageText.trim() || !selectedSession || sendMutation.isPending}
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}
