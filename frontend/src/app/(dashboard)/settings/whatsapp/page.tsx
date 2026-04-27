'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api-client';
import { getSocket } from '@/lib/socket';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Smartphone } from 'lucide-react';

interface Session {
  id: string;
  phoneNumber?: string;
  displayName?: string;
  status: string;
  lastSeenAt?: string;
  createdAt: string;
}

const statusVariant: Record<string, 'success' | 'warning' | 'destructive' | 'secondary'> = {
  CONNECTED: 'success',
  CONNECTING: 'warning',
  QR_READY: 'warning',
  DISCONNECTED: 'secondary',
  TOS_BLOCK: 'destructive',
  BANNED: 'destructive',
};

export default function WhatsAppSettingsPage() {
  const queryClient = useQueryClient();
  const [liveStatuses, setLiveStatuses] = useState<Record<string, string>>({});

  const sessions = useQuery({
    queryKey: ['sessions'],
    queryFn: () => api.get<Session[]>('/whatsapp/sessions'),
  });

  // Listen for real-time session status changes
  useEffect(() => {
    const socket = getSocket();
    const handler = (data: { sessionId: string; status: string }) => {
      setLiveStatuses((prev) => ({ ...prev, [data.sessionId]: data.status }));
    };
    socket.on('session:status', handler);
    return () => { socket.off('session:status', handler); };
  }, []);

  const createMutation = useMutation({
    mutationFn: () => api.post('/whatsapp/sessions'),
    onSuccess: () => {
      toast.success('Session created — scan QR code on the session-manager service');
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/whatsapp/sessions/${id}`),
    onSuccess: () => {
      toast.success('Session deleted');
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
  });

  const sessionList = Array.isArray(sessions.data) ? sessions.data : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">WhatsApp Sessions</h1>
          <p className="text-muted-foreground mt-1">Manage your connected WhatsApp numbers</p>
        </div>
        <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
          <Plus className="mr-2 h-4 w-4" />
          {createMutation.isPending ? 'Creating...' : 'New Session'}
        </Button>
      </div>

      {sessionList.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12">
            <Smartphone className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No WhatsApp sessions</p>
            <p className="text-muted-foreground text-sm mt-1">Create a session and scan the QR code to connect your WhatsApp.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sessionList.map((s) => {
            const status = liveStatuses[s.id] || s.status;
            return (
              <Card key={s.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      {s.displayName || s.phoneNumber || `Session ${s.id.slice(0, 8)}`}
                    </CardTitle>
                    <Badge variant={statusVariant[status] ?? 'secondary'}>{status}</Badge>
                  </div>
                  {s.phoneNumber && (
                    <CardDescription className="font-mono text-xs">{s.phoneNumber}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div className="flex justify-between">
                      <span>Created</span>
                      <span>{new Date(s.createdAt).toLocaleDateString()}</span>
                    </div>
                    {s.lastSeenAt && (
                      <div className="flex justify-between">
                        <span>Last seen</span>
                        <span>{new Date(s.lastSeenAt).toLocaleString()}</span>
                      </div>
                    )}
                  </div>

                  {status === 'QR_READY' && (
                    <div className="rounded-md bg-gray-100 p-4 text-center">
                      <p className="text-sm text-muted-foreground">
                        Scan the QR code in the session-manager terminal
                      </p>
                    </div>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-destructive"
                    onClick={() => deleteMutation.mutate(s.id)}
                  >
                    <Trash2 className="mr-2 h-3 w-3" /> Delete Session
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
