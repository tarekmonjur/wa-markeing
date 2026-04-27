'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Plus, Trash2, Smartphone, Loader2, Wifi, WifiOff,
  Pencil, X, Check, QrCode,
} from 'lucide-react';

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

  // --- New Session Form ---
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');

  // --- Edit Session ---
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');

  // --- QR Connect ---
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [sessionState, setSessionState] = useState<string>('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const sessions = useQuery({
    queryKey: ['sessions'],
    queryFn: () => api.get<Session[]>('/whatsapp/sessions'),
  });

  // --- Create ---
  const createMutation = useMutation({
    mutationFn: (data: { displayName: string; phoneNumber: string }) =>
      api.post<Session>('/whatsapp/sessions', data),
    onSuccess: () => {
      toast.success('Session created');
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      setShowForm(false);
      setFormName('');
      setFormPhone('');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleCreate = () => {
    if (!formName.trim() || !formPhone.trim()) {
      toast.error('Name and phone number are required');
      return;
    }
    createMutation.mutate({ displayName: formName.trim(), phoneNumber: formPhone.trim() });
  };

  // --- Edit ---
  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { displayName?: string; phoneNumber?: string } }) =>
      api.patch<Session>(`/whatsapp/sessions/${id}`, data),
    onSuccess: () => {
      toast.success('Session updated');
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      setEditingId(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const startEdit = (s: Session) => {
    setEditingId(s.id);
    setEditName(s.displayName || '');
    setEditPhone(s.phoneNumber || '');
  };

  const handleEdit = (id: string) => {
    editMutation.mutate({ id, data: { displayName: editName.trim(), phoneNumber: editPhone.trim() } });
  };

  // --- Delete ---
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/session-api/sessions/${id}`, { method: 'DELETE' }).catch(() => {});
      return api.delete(`/whatsapp/sessions/${id}`);
    },
    onSuccess: () => {
      toast.success('Session deleted');
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      if (connectingId) stopListening();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // --- Disconnect ---
  const disconnectMutation = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/session-api/sessions/${id}`, { method: 'DELETE' }).catch(() => {});
      return api.post<Session>(`/whatsapp/sessions/${id}/disconnect`);
    },
    onSuccess: () => {
      toast.success('Session disconnected');
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // --- QR Connect ---
  const stopListening = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setConnectingId(null);
    setQrDataUrl(null);
    setSessionState('');
  }, []);

  const startConnect = useCallback(async (sessionId: string) => {
    stopListening();
    setConnectingId(sessionId);
    setSessionState('CONNECTING');

    try {
      const res = await fetch(`/session-api/sessions/${sessionId}/connect`, {
        method: 'POST',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Connection failed' }));
        throw new Error(err.error);
      }
    } catch (err: any) {
      toast.error(`Connect failed: ${err.message}`);
      setConnectingId(null);
      return;
    }

    const poll = async () => {
      try {
        const res = await fetch(`/session-api/sessions/${sessionId}/status`);
        if (!res.ok) return;
        const data = await res.json();

        setSessionState(data.state);
        if (data.qrDataUrl) setQrDataUrl(data.qrDataUrl);

        if (data.state === 'CONNECTED') {
          await api.patch(`/whatsapp/sessions/${sessionId}/status`, { status: 'CONNECTED' });
          toast.success('WhatsApp connected!');
          queryClient.invalidateQueries({ queryKey: ['sessions'] });
          stopListening();
        }

        if (data.state === 'BANNED') {
          await api.patch(`/whatsapp/sessions/${sessionId}/status`, { status: 'BANNED' });
          toast.error('Session banned by WhatsApp');
          queryClient.invalidateQueries({ queryKey: ['sessions'] });
          stopListening();
        }

        // CONNECTING state means Baileys is retrying — keep polling, show spinner
        // DISCONNECTED after retries exhausted — stop
        if (data.state === 'DISCONNECTED') {
          await api.patch(`/whatsapp/sessions/${sessionId}/status`, { status: 'DISCONNECTED' });
          toast.error('Connection failed after retries. Try again.');
          queryClient.invalidateQueries({ queryKey: ['sessions'] });
          stopListening();
        }
      } catch {
        // network error — keep polling
      }
    };

    poll();
    pollRef.current = setInterval(poll, 2000);
  }, [stopListening, queryClient]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const sessionList = Array.isArray(sessions.data) ? sessions.data : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">WhatsApp Sessions</h1>
          <p className="text-muted-foreground mt-1">Manage your connected WhatsApp numbers</p>
        </div>
        {!showForm && (
          <Button onClick={() => setShowForm(true)} disabled={!!connectingId}>
            <Plus className="mr-2 h-4 w-4" />
            New Session
          </Button>
        )}
      </div>

      {/* New Session Form */}
      {showForm && (
        <Card className="border-2 border-primary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-primary" />
              Add New Session
            </CardTitle>
            <CardDescription>
              Enter the contact name and WhatsApp number for this session.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Display Name</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Rahim - Dhaka Fashion"
                className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Phone Number</label>
              <input
                type="tel"
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
                placeholder="+8801712345678"
                className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <p className="text-xs text-muted-foreground mt-1">International format with country code</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreate} disabled={createMutation.isPending}>
                {createMutation.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating...</>
                ) : (
                  <><Check className="mr-2 h-4 w-4" />Create Session</>
                )}
              </Button>
              <Button variant="outline" onClick={() => { setShowForm(false); setFormName(''); setFormPhone(''); }}>
                <X className="mr-2 h-4 w-4" />Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* QR Code Panel */}
      {connectingId && (
        <Card className="border-2 border-primary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {sessionState === 'QR_READY' ? (
                <QrCode className="h-5 w-5 text-primary" />
              ) : (
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              )}
              {sessionState === 'QR_READY'
                ? 'Scan QR Code with WhatsApp'
                : sessionState === 'CONNECTING'
                  ? 'Connecting to WhatsApp... please wait'
                  : sessionState === 'TOS_BLOCK'
                    ? 'Connection blocked — retrying...'
                    : sessionState}
            </CardTitle>
            <CardDescription>
              Open WhatsApp on your phone &rarr; Settings &rarr; Linked Devices &rarr; Link a Device
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            {qrDataUrl ? (
              <div className="rounded-lg bg-white p-4 shadow-sm">
                <img src={qrDataUrl} alt="WhatsApp QR Code" className="h-[280px] w-[280px]" />
              </div>
            ) : (
              <div className="flex h-[280px] w-[280px] items-center justify-center rounded-lg bg-gray-100">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}
            <p className="text-sm text-muted-foreground">QR code refreshes automatically</p>
            <Button variant="outline" onClick={stopListening}>Cancel</Button>
          </CardContent>
        </Card>
      )}

      {/* Session List */}
      {sessionList.length === 0 && !showForm && !connectingId ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12">
            <Smartphone className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No WhatsApp sessions</p>
            <p className="text-muted-foreground text-sm mt-1">Add a session with your WhatsApp number to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sessionList.map((s) => (
            <Card key={s.id} className={connectingId === s.id ? 'ring-2 ring-primary' : ''}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  {editingId === s.id ? (
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="rounded border px-2 py-1 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary flex-1 mr-2"
                    />
                  ) : (
                    <CardTitle className="text-base">
                      {s.displayName || `Session ${s.id.slice(0, 8)}`}
                    </CardTitle>
                  )}
                  <Badge variant={statusVariant[s.status] ?? 'secondary'}>{s.status}</Badge>
                </div>
                {editingId === s.id ? (
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="rounded border px-2 py-1 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary mt-1"
                  />
                ) : (
                  s.phoneNumber && (
                    <CardDescription className="font-mono text-xs">{s.phoneNumber}</CardDescription>
                  )
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

                {/* Edit mode buttons */}
                {editingId === s.id ? (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleEdit(s.id)} disabled={editMutation.isPending}>
                      <Check className="mr-1 h-3 w-3" /> Save
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                      <X className="mr-1 h-3 w-3" /> Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2 flex-wrap">
                    {/* Connect button — only when DISCONNECTED or error states */}
                    {(s.status === 'DISCONNECTED' || s.status === 'TOS_BLOCK' || s.status === 'BANNED') && (
                      <Button
                        variant="default"
                        size="sm"
                        className="flex-1"
                        onClick={() => startConnect(s.id)}
                        disabled={!!connectingId}
                      >
                        <QrCode className="mr-2 h-3 w-3" /> Connect
                      </Button>
                    )}

                    {/* Connected status */}
                    {s.status === 'CONNECTED' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-green-600 border-green-200"
                        disabled
                      >
                        <Wifi className="mr-2 h-3 w-3" /> Connected
                      </Button>
                    )}

                    {/* Disconnect — only when CONNECTED */}
                    {s.status === 'CONNECTED' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => disconnectMutation.mutate(s.id)}
                        disabled={disconnectMutation.isPending}
                      >
                        <WifiOff className="h-3 w-3" />
                      </Button>
                    )}

                    {/* Edit */}
                    <Button variant="outline" size="sm" onClick={() => startEdit(s)}>
                      <Pencil className="h-3 w-3" />
                    </Button>

                    {/* Delete */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive"
                      onClick={() => {
                        if (confirm('Delete this session? This cannot be undone.')) {
                          deleteMutation.mutate(s.id);
                        }
                      }}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
