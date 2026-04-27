'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Key, Plus, Copy, Trash2 } from 'lucide-react';

interface ApiKeyRecord {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
}

export default function ApiKeysPage() {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [newKey, setNewKey] = useState<string | null>(null);

  const { data: keys, isLoading } = useQuery({
    queryKey: ['api-keys'],
    queryFn: () => api.get<ApiKeyRecord[]>('/api-keys'),
  });

  const createMutation = useMutation({
    mutationFn: (keyName: string) =>
      api.post<{ key: string; id: string; keyPrefix: string }>('/api-keys', {
        name: keyName,
      }),
    onSuccess: (data) => {
      setNewKey(data.key);
      setName('');
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      toast.success('API key created');
    },
    onError: () => toast.error('Failed to create API key'),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/api-keys/${id}/revoke`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      toast.success('API key revoked');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api-keys/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      toast.success('API key deleted');
    },
  });

  const copyKey = () => {
    if (newKey) {
      navigator.clipboard.writeText(newKey);
      toast.success('Copied to clipboard');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">API Keys</h1>
        <p className="text-muted-foreground">
          Manage API keys for external integrations
        </p>
      </div>

      {newKey && (
        <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">
              Copy your API key now. It won&apos;t be shown again.
            </p>
            <div className="flex gap-2">
              <code className="flex-1 bg-white dark:bg-zinc-900 p-2 rounded text-sm font-mono break-all">
                {newKey}
              </code>
              <Button size="icon" variant="outline" onClick={copyKey}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={() => setNewKey(null)}
            >
              Dismiss
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Create New API Key
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Key name (e.g. My CRM Integration)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Button
              onClick={() => createMutation.mutate(name)}
              disabled={!name.trim() || createMutation.isPending}
            >
              Create
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Your API Keys
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-4 text-muted-foreground">
              Loading...
            </div>
          ) : !keys?.length ? (
            <div className="text-center py-4 text-muted-foreground">
              No API keys yet
            </div>
          ) : (
            <div className="space-y-3">
              {keys.map((key) => (
                <div
                  key={key.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div>
                    <div className="font-medium">{key.name}</div>
                    <div className="text-sm text-muted-foreground">
                      <code>{key.keyPrefix}...</code>
                      {key.lastUsedAt && (
                        <span className="ml-2">
                          Last used:{' '}
                          {new Date(key.lastUsedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={key.isActive ? 'success' : 'destructive'}
                    >
                      {key.isActive ? 'Active' : 'Revoked'}
                    </Badge>
                    {key.isActive && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => revokeMutation.mutate(key.id)}
                      >
                        Revoke
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        if (confirm('Delete this API key permanently?')) {
                          deleteMutation.mutate(key.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
