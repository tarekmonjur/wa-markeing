'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Inbox, MessageSquare } from 'lucide-react';
import Link from 'next/link';

interface ConversationSummary {
  contactId: string;
  contactName?: string;
  contactPhone: string;
  lastMessage: string;
  lastMessageAt: string;
  lastDirection: string;
  unreadCount: number;
}

export default function InboxPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['inbox'],
    queryFn: () => api.get<{ data: ConversationSummary[]; total: number }>('/inbox'),
    refetchInterval: 10000,
  });

  const conversations = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Inbox</h1>
        <p className="text-muted-foreground mt-1">View and reply to WhatsApp conversations</p>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading conversations...</div>
      ) : conversations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12">
            <Inbox className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No conversations yet</p>
            <p className="text-muted-foreground text-sm mt-1">
              Conversations will appear here when contacts message you.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {conversations.map((conv) => (
            <Link key={conv.contactId} href={`/inbox/${conv.contactId}`}>
              <Card className="hover:bg-gray-50 transition-colors cursor-pointer">
                <CardContent className="py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-brand-700 font-medium">
                      {(conv.contactName ?? conv.contactPhone).charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">
                          {conv.contactName ?? conv.contactPhone}
                        </span>
                        {conv.unreadCount > 0 && (
                          <Badge variant="destructive" className="text-xs">
                            {conv.unreadCount}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate max-w-md">
                        {conv.lastDirection === 'INBOUND' && (
                          <MessageSquare className="inline h-3 w-3 mr-1" />
                        )}
                        {conv.lastMessage || 'No message'}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap ml-4">
                    {new Date(conv.lastMessageAt).toLocaleDateString()}
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
