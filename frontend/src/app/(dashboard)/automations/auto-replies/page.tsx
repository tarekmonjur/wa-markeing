'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Bot, ToggleLeft, ToggleRight } from 'lucide-react';
import Link from 'next/link';

interface AutoReplyRule {
  id: string;
  keyword: string;
  matchType: string;
  replyBody: string;
  isActive: boolean;
  priority: number;
  createdAt: string;
}

export default function AutoRepliesPage() {
  const queryClient = useQueryClient();

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['auto-reply-rules'],
    queryFn: () => api.get<AutoReplyRule[]>('/auto-reply-rules'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/auto-reply-rules/${id}`),
    onSuccess: () => {
      toast.success('Rule deleted');
      queryClient.invalidateQueries({ queryKey: ['auto-reply-rules'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/auto-reply-rules/${id}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auto-reply-rules'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const ruleList = Array.isArray(rules) ? rules : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Auto-Reply Rules</h1>
          <p className="text-muted-foreground mt-1">
            Automatic responses to inbound WhatsApp messages
          </p>
        </div>
        <Link href="/automations/auto-replies/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" /> New Rule
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : ruleList.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12">
            <Bot className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No auto-reply rules</p>
            <p className="text-muted-foreground text-sm mt-1">
              Create rules to automatically respond to keywords.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {ruleList.map((rule) => (
            <Card key={rule.id}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono">
                        {rule.keyword}
                      </code>
                      <Badge variant="secondary">{rule.matchType}</Badge>
                      <Badge variant={rule.isActive ? 'success' : 'secondary'}>
                        {rule.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        Priority: {rule.priority}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      Reply: {rule.replyBody}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        toggleMutation.mutate({
                          id: rule.id,
                          isActive: !rule.isActive,
                        })
                      }
                    >
                      {rule.isActive ? (
                        <ToggleRight className="h-5 w-5 text-green-600" />
                      ) : (
                        <ToggleLeft className="h-5 w-5 text-gray-400" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      onClick={() => deleteMutation.mutate(rule.id)}
                      disabled={rule.priority >= 9999}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
