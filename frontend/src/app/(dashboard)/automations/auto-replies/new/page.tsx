'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

const MATCH_TYPES = ['EXACT', 'CONTAINS', 'STARTS_WITH', 'REGEX'];

export default function NewAutoReplyPage() {
  const router = useRouter();
  const [keyword, setKeyword] = useState('');
  const [matchType, setMatchType] = useState('CONTAINS');
  const [replyBody, setReplyBody] = useState('');
  const [priority, setPriority] = useState(0);

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/auto-reply-rules', data),
    onSuccess: () => {
      toast.success('Auto-reply rule created');
      router.push('/automations/auto-replies');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyword.trim() || !replyBody.trim()) {
      toast.error('Keyword and reply body are required');
      return;
    }
    createMutation.mutate({ keyword, matchType, replyBody, priority });
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">New Auto-Reply Rule</h1>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Keyword</label>
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="e.g., price, stop, order"
                className="w-full rounded border px-3 py-2 text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Match Type</label>
              <select
                value={matchType}
                onChange={(e) => setMatchType(e.target.value)}
                className="w-full rounded border px-3 py-2 text-sm"
              >
                {MATCH_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground mt-1">
                EXACT: entire message matches. CONTAINS: keyword appears anywhere. STARTS_WITH: message begins with keyword. REGEX: regular expression.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Reply Message</label>
              <textarea
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
                placeholder="The auto-reply message..."
                rows={4}
                className="w-full rounded border px-3 py-2 text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Priority</label>
              <input
                type="number"
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value))}
                className="w-full rounded border px-3 py-2 text-sm"
                min={0}
                max={9998}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Higher priority rules are checked first. System STOP rule has priority 9999.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create Rule'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/automations/auto-replies')}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
