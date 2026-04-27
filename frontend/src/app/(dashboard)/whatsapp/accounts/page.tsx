'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Trash2, Wifi, WifiOff, Heart } from 'lucide-react';

interface WaSession {
  id: string;
  displayName?: string;
  phoneNumber?: string;
  label: string;
  isDefault: boolean;
  status: string;
  lastSeenAt?: string;
}

interface AccountHealth {
  sessionId: string;
  score: number;
  level: 'GREEN' | 'YELLOW' | 'RED';
  deliveryRate: number;
  failRate: number;
  replyRate: number;
}

const healthColors: Record<string, string> = {
  GREEN: 'bg-green-100 text-green-700',
  YELLOW: 'bg-yellow-100 text-yellow-700',
  RED: 'bg-red-100 text-red-700',
};

export default function WhatsAppAccountsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  const { data: sessions = [] } = useQuery({
    queryKey: ['wa-sessions'],
    queryFn: () => api.get<WaSession[]>('/whatsapp/sessions'),
  });

  const { data: healthData = [] } = useQuery({
    queryKey: ['wa-health'],
    queryFn: () => api.get<AccountHealth[]>('/whatsapp/sessions/health/all'),
    enabled: sessions.length > 0,
  });

  const healthMap = new Map(healthData.map((h) => [h.sessionId, h]));

  const createMutation = useMutation({
    mutationFn: () =>
      api.post('/whatsapp/sessions', { displayName, phoneNumber }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wa-sessions'] });
      setShowForm(false);
      setDisplayName('');
      setPhoneNumber('');
      toast.success('Account added');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/whatsapp/sessions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wa-sessions'] });
      toast.success('Account removed');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">WhatsApp Accounts</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Add Account
        </button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium">Display Name</label>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Business Account"
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Phone Number</label>
                <input
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+8801XXXXXXXXX"
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                />
              </div>
            </div>
            <button
              onClick={() => createMutation.mutate()}
              disabled={!displayName || !phoneNumber || createMutation.isPending}
              className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {createMutation.isPending ? 'Adding...' : 'Add Account'}
            </button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {sessions.map((session) => {
          const health = healthMap.get(session.id);
          return (
            <Card key={session.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      {session.status === 'CONNECTED' ? (
                        <Wifi className="h-5 w-5 text-green-500" />
                      ) : (
                        <WifiOff className="h-5 w-5 text-gray-400" />
                      )}
                      <div>
                        <p className="font-medium">
                          {session.displayName || session.label}
                        </p>
                        <p className="text-sm text-gray-500">
                          {session.phoneNumber ?? 'No phone yet'}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant={session.status === 'CONNECTED' ? 'success' : 'secondary'}
                    >
                      {session.status}
                    </Badge>
                    {session.isDefault && (
                      <Badge variant="default">Default</Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Health Score Badge */}
                    {health && (
                      <div className="flex items-center gap-2">
                        <Heart className="h-4 w-4 text-gray-400" />
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${healthColors[health.level]}`}
                        >
                          {health.score}/100
                        </span>
                        <span className="text-xs text-gray-500">
                          D:{health.deliveryRate}% F:{health.failRate}% R:{health.replyRate}%
                        </span>
                      </div>
                    )}

                    <button
                      onClick={() => {
                        if (confirm('Delete this account?'))
                          deleteMutation.mutate(session.id);
                      }}
                      className="p-2 rounded hover:bg-red-50 text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Health warning for RED accounts */}
                {health && health.level === 'RED' && (
                  <div className="mt-3 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                    ⚠️ This account has a low health score. Consider reducing send volume or checking message quality before launching campaigns.
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}

        {sessions.length === 0 && (
          <p className="text-center text-gray-500 py-8">
            No WhatsApp accounts connected. Click &ldquo;Add Account&rdquo; to get started.
          </p>
        )}
      </div>
    </div>
  );
}
