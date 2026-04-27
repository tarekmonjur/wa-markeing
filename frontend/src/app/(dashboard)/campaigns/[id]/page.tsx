'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { api } from '@/lib/api-client';
import { getSocket } from '@/lib/socket';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Play, Pause, XCircle, Pencil, Trash2 } from 'lucide-react';

interface Campaign {
  id: string;
  name: string;
  status: string;
  totalContacts: number;
  sentCount: number;
  deliveredCount: number;
  failedCount: number;
  scheduledAt?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  template?: { name: string; body: string };
  group?: { name: string };
  session?: { phoneNumber?: string; status: string };
}

const statusVariant: Record<string, 'success' | 'warning' | 'destructive' | 'secondary' | 'default'> = {
  COMPLETED: 'success',
  RUNNING: 'warning',
  DRAFT: 'secondary',
  PAUSED: 'default',
  FAILED: 'destructive',
};

export default function CampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = params.id as string;

  const [live, setLive] = useState({ sentCount: 0, deliveredCount: 0, failedCount: 0 });

  const { data: campaign, isLoading } = useQuery({
    queryKey: ['campaign', id],
    queryFn: () => api.get<Campaign>(`/campaigns/${id}`),
  });

  // WebSocket live update
  useEffect(() => {
    const socket = getSocket();
    const handler = (data: any) => {
      if (data.campaignId === id) {
        setLive({ sentCount: data.sentCount, deliveredCount: data.deliveredCount, failedCount: data.failedCount });
      }
    };
    socket.on('campaign:progress', handler);
    socket.on('campaign:completed', () => {
      queryClient.invalidateQueries({ queryKey: ['campaign', id] });
    });
    return () => {
      socket.off('campaign:progress', handler);
      socket.off('campaign:completed');
    };
  }, [id, queryClient]);

  const startMutation = useMutation({
    mutationFn: () => api.post(`/campaigns/${id}/start`),
    onSuccess: () => { toast.success('Campaign started'); queryClient.invalidateQueries({ queryKey: ['campaign', id] }); },
    onError: (err: Error) => toast.error(err.message),
  });

  const pauseMutation = useMutation({
    mutationFn: () => api.post(`/campaigns/${id}/pause`),
    onSuccess: () => { toast.success('Campaign paused'); queryClient.invalidateQueries({ queryKey: ['campaign', id] }); },
    onError: (err: Error) => toast.error(err.message),
  });

  const cancelMutation = useMutation({
    mutationFn: () => api.post(`/campaigns/${id}/cancel`),
    onSuccess: () => { toast.success('Campaign cancelled'); queryClient.invalidateQueries({ queryKey: ['campaign', id] }); },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/campaigns/${id}`),
    onSuccess: () => {
      toast.success('Campaign deleted');
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      router.push('/campaigns');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleDelete = () => {
    if (!confirm(`Delete campaign "${campaign?.name}"? This cannot be undone.`)) return;
    deleteMutation.mutate();
  };

  if (isLoading) return <p>Loading...</p>;
  if (!campaign) return <p>Campaign not found</p>;

  const sent = campaign.status === 'RUNNING' ? live.sentCount || campaign.sentCount : campaign.sentCount;
  const delivered = campaign.status === 'RUNNING' ? live.deliveredCount || campaign.deliveredCount : campaign.deliveredCount;
  const failed = campaign.status === 'RUNNING' ? live.failedCount || campaign.failedCount : campaign.failedCount;
  const total = campaign.totalContacts || 1;
  const progress = Math.round((sent / total) * 100);

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={() => router.back()}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Back
      </Button>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{campaign.name}</h1>
          <Badge variant={statusVariant[campaign.status] ?? 'secondary'} className="mt-2">{campaign.status}</Badge>
        </div>
        <div className="flex gap-2">
          {campaign.status === 'DRAFT' && (
            <Button variant="outline" onClick={() => router.push(`/campaigns/${id}/edit`)}>
              <Pencil className="mr-2 h-4 w-4" /> Edit
            </Button>
          )}
          {(campaign.status === 'DRAFT' || campaign.status === 'PAUSED') && (
            <Button onClick={() => startMutation.mutate()} disabled={startMutation.isPending}>
              <Play className="mr-2 h-4 w-4" /> {campaign.status === 'PAUSED' ? 'Resume' : 'Start'}
            </Button>
          )}
          {campaign.status === 'RUNNING' && (
            <Button variant="outline" onClick={() => pauseMutation.mutate()} disabled={pauseMutation.isPending}>
              <Pause className="mr-2 h-4 w-4" /> Pause
            </Button>
          )}
          {['RUNNING', 'PAUSED', 'SCHEDULED'].includes(campaign.status) && (
            <Button variant="destructive" onClick={() => cancelMutation.mutate()} disabled={cancelMutation.isPending}>
              <XCircle className="mr-2 h-4 w-4" /> Cancel
            </Button>
          )}
          {['DRAFT', 'COMPLETED', 'FAILED'].includes(campaign.status) && (
            <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>
              <Trash2 className="mr-2 h-4 w-4" /> Delete
            </Button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Progress</span>
            <span className="text-sm text-muted-foreground">{progress}%</span>
          </div>
          <div className="h-3 w-full rounded-full bg-gray-200">
            <div
              className="h-3 rounded-full bg-brand-500 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-2xl font-bold">{total}</p>
            <p className="text-sm text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-2xl font-bold text-blue-600">{sent}</p>
            <p className="text-sm text-muted-foreground">Sent</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-2xl font-bold text-green-600">{delivered}</p>
            <p className="text-sm text-muted-foreground">Delivered</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-2xl font-bold text-red-600">{failed}</p>
            <p className="text-sm text-muted-foreground">Failed</p>
          </CardContent>
        </Card>
      </div>

      {/* Details */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-lg">Campaign Details</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Template</span><span>{campaign.template?.name ?? '—'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Contact Group</span><span>{campaign.group?.name ?? '—'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Session</span><span>{campaign.session?.phoneNumber ?? '—'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Created</span><span>{new Date(campaign.createdAt).toLocaleString()}</span></div>
            {campaign.startedAt && <div className="flex justify-between"><span className="text-muted-foreground">Started</span><span>{new Date(campaign.startedAt).toLocaleString()}</span></div>}
            {campaign.completedAt && <div className="flex justify-between"><span className="text-muted-foreground">Completed</span><span>{new Date(campaign.completedAt).toLocaleString()}</span></div>}
          </CardContent>
        </Card>
        {campaign.template && (
          <Card>
            <CardHeader><CardTitle className="text-lg">Template Preview</CardTitle></CardHeader>
            <CardContent>
              <div className="whitespace-pre-wrap rounded-md bg-gray-50 p-4 text-sm">{campaign.template.body}</div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
