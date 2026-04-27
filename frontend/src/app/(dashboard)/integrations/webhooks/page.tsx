'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Trash2, Eye, EyeOff } from 'lucide-react';

interface WebhookEndpoint {
  id: string;
  url: string;
  secret: string;
  events: string[];
  isActive: boolean;
  createdAt: string;
}

interface WebhookDelivery {
  id: string;
  event: string;
  status: string;
  responseCode: number | null;
  attemptCount: number;
  createdAt: string;
}

const availableEvents = [
  'campaign.started',
  'campaign.completed',
  'message.sent',
  'message.delivered',
  'message.failed',
];

export default function WebhooksPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [url, setUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [viewSecret, setViewSecret] = useState<string | null>(null);
  const [viewDeliveries, setViewDeliveries] = useState<string | null>(null);

  const { data: endpoints = [] } = useQuery({
    queryKey: ['webhooks'],
    queryFn: () => api.get<WebhookEndpoint[]>('/webhooks'),
  });

  const { data: deliveries = [] } = useQuery({
    queryKey: ['webhook-deliveries', viewDeliveries],
    queryFn: () => api.get<WebhookDelivery[]>(`/webhooks/${viewDeliveries}/deliveries`),
    enabled: !!viewDeliveries,
  });

  const createMutation = useMutation({
    mutationFn: () => api.post('/webhooks', { url, events: selectedEvents }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      setShowForm(false);
      setUrl('');
      setSelectedEvents([]);
      toast.success('Webhook endpoint created');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/webhooks/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      toast.success('Webhook deleted');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/webhooks/${id}`, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['webhooks'] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Webhooks</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Add Webhook
        </button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <div>
              <label className="text-sm font-medium">Endpoint URL</label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://your-server.com/webhook"
                className="mt-1 w-full rounded-lg border px-3 py-2"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Events</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {availableEvents.map((evt) => (
                  <label key={evt} className="flex items-center gap-1.5 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedEvents.includes(evt)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedEvents([...selectedEvents, evt]);
                        else setSelectedEvents(selectedEvents.filter((s) => s !== evt));
                      }}
                    />
                    {evt}
                  </label>
                ))}
              </div>
            </div>
            <button
              onClick={() => createMutation.mutate()}
              disabled={!url || selectedEvents.length === 0 || createMutation.isPending}
              className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {createMutation.isPending ? 'Creating...' : 'Create Webhook'}
            </button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {endpoints.map((ep) => (
          <Card key={ep.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="font-mono text-sm break-all">{ep.url}</p>
                  <div className="flex flex-wrap gap-1">
                    {ep.events.map((evt) => (
                      <Badge key={evt} variant="secondary" className="text-xs">
                        {evt}
                      </Badge>
                    ))}
                  </div>
                  {viewSecret === ep.id && (
                    <p className="font-mono text-xs text-gray-500 break-all mt-1">
                      Secret: {ep.secret}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setViewSecret(viewSecret === ep.id ? null : ep.id)}
                    className="p-2 rounded hover:bg-gray-100"
                    title="Toggle secret"
                  >
                    {viewSecret === ep.id ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={() =>
                      toggleMutation.mutate({ id: ep.id, isActive: !ep.isActive })
                    }
                    className={`px-2 py-1 text-xs rounded ${ep.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                  >
                    {ep.isActive ? 'Active' : 'Inactive'}
                  </button>
                  <button
                    onClick={() => setViewDeliveries(viewDeliveries === ep.id ? null : ep.id)}
                    className="px-2 py-1 text-xs rounded border hover:bg-gray-50"
                  >
                    Deliveries
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('Delete this webhook?')) deleteMutation.mutate(ep.id);
                    }}
                    className="p-2 rounded hover:bg-red-50 text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {viewDeliveries === ep.id && deliveries.length > 0 && (
                <div className="mt-4 border-t pt-4">
                  <p className="text-sm font-medium mb-2">Recent Deliveries</p>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b text-gray-500">
                        <th className="py-1 text-left">Event</th>
                        <th className="py-1 text-left">Status</th>
                        <th className="py-1 text-left">Code</th>
                        <th className="py-1 text-left">Attempts</th>
                        <th className="py-1 text-left">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deliveries.map((d) => (
                        <tr key={d.id} className="border-b">
                          <td className="py-1">{d.event}</td>
                          <td className="py-1">
                            <Badge
                              variant={
                                d.status === 'DELIVERED'
                                  ? 'success'
                                  : d.status === 'ABANDONED'
                                    ? 'destructive'
                                    : 'default'
                              }
                            >
                              {d.status}
                            </Badge>
                          </td>
                          <td className="py-1">{d.responseCode ?? '-'}</td>
                          <td className="py-1">{d.attemptCount}</td>
                          <td className="py-1">{new Date(d.createdAt).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {endpoints.length === 0 && (
          <p className="text-center text-gray-500 py-8">
            No webhook endpoints yet. Click &quot;Add Webhook&quot; to create one.
          </p>
        )}
      </div>
    </div>
  );
}
