'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api-client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useState } from 'react';

interface CampaignStats {
  campaignId: string;
  totalContacts: number;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  failedCount: number;
  repliedCount: number;
  deliveryRate: number;
  readRate: number;
  replyRate: number;
}

interface MessageContact {
  id: string;
  contact: { name: string; phone: string } | null;
  status: string;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  failReason: string | null;
}

interface ExportJob {
  id: string;
  status: string;
  downloadUrl?: string;
}

export default function CampaignAnalyticsPage() {
  const { id } = useParams<{ id: string }>();
  const [exportJobId, setExportJobId] = useState<string | null>(null);

  const { data: stats, isLoading } = useQuery({
    queryKey: ['analytics', 'campaign', id],
    queryFn: () => api.get<CampaignStats>(`/analytics/campaigns/${id}`),
  });

  const { data: contactsData } = useQuery({
    queryKey: ['analytics', 'campaign', id, 'contacts'],
    queryFn: () => api.get<{ data: MessageContact[]; total: number }>(`/analytics/campaigns/${id}/contacts`),
  });

  const exportMutation = useMutation({
    mutationFn: (format: string) =>
      api.post<ExportJob>(`/analytics/campaigns/${id}/export?format=${format}`),
    onSuccess: (job) => {
      setExportJobId(job.id);
      toast.success('Export started! Polling for completion...');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const { data: exportJob } = useQuery({
    queryKey: ['export', exportJobId],
    queryFn: () => api.get<ExportJob>(`/analytics/exports/${exportJobId}`),
    enabled: !!exportJobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'COMPLETE' || status === 'FAILED' ? false : 2000;
    },
  });

  const contacts = contactsData?.data ?? [];

  const statCards = stats
    ? [
        { label: 'Total', value: stats.totalContacts, color: 'text-gray-700' },
        { label: 'Sent', value: stats.sentCount, color: 'text-blue-600' },
        { label: 'Delivered', value: `${stats.deliveredCount} (${(stats.deliveryRate * 100).toFixed(1)}%)`, color: 'text-green-600' },
        { label: 'Read', value: `${stats.readCount} (${(stats.readRate * 100).toFixed(1)}%)`, color: 'text-purple-600' },
        { label: 'Replied', value: `${stats.repliedCount} (${(stats.replyRate * 100).toFixed(1)}%)`, color: 'text-indigo-600' },
        { label: 'Failed', value: stats.failedCount, color: 'text-red-600' },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Campaign Analytics</h1>
        <div className="flex gap-2">
          <button
            onClick={() => exportMutation.mutate('csv')}
            disabled={exportMutation.isPending}
            className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50"
          >
            Export CSV
          </button>
          <button
            onClick={() => exportMutation.mutate('pdf')}
            disabled={exportMutation.isPending}
            className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50"
          >
            Export PDF
          </button>
        </div>
      </div>

      {exportJob?.status === 'COMPLETE' && exportJob.downloadUrl && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <a
            href={exportJob.downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-green-700 underline font-medium"
          >
            Download Export File
          </a>
        </div>
      )}

      {isLoading ? (
        <p className="text-gray-500">Loading analytics...</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {statCards.map((s) => (
              <Card key={s.label}>
                <CardContent className="p-4 text-center">
                  <p className="text-xs text-gray-500">{s.label}</p>
                  <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Delivery funnel */}
          {stats && (
            <Card>
              <CardHeader>
                <CardTitle>Delivery Funnel</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { label: 'Sent', value: stats.sentCount, total: stats.totalContacts, color: 'bg-blue-500' },
                    { label: 'Delivered', value: stats.deliveredCount, total: stats.sentCount, color: 'bg-green-500' },
                    { label: 'Read', value: stats.readCount, total: stats.deliveredCount, color: 'bg-purple-500' },
                    { label: 'Replied', value: stats.repliedCount, total: stats.deliveredCount, color: 'bg-indigo-500' },
                  ].map((step) => {
                    const pct = step.total > 0 ? (step.value / step.total) * 100 : 0;
                    return (
                      <div key={step.label}>
                        <div className="flex justify-between text-sm mb-1">
                          <span>{step.label}</span>
                          <span>{step.value} ({pct.toFixed(1)}%)</span>
                        </div>
                        <div className="h-3 rounded-full bg-gray-100">
                          <div
                            className={`h-full rounded-full ${step.color}`}
                            style={{ width: `${Math.min(100, pct)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Per-contact table */}
          <Card>
            <CardHeader>
              <CardTitle>Contact Delivery Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-500">
                      <th className="py-2 pr-4">Contact</th>
                      <th className="py-2 pr-4">Phone</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2 pr-4">Sent</th>
                      <th className="py-2 pr-4">Delivered</th>
                      <th className="py-2">Failed Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contacts.map((c) => (
                      <tr key={c.id} className="border-b">
                        <td className="py-2 pr-4">{c.contact?.name ?? 'Unknown'}</td>
                        <td className="py-2 pr-4 font-mono text-xs">{c.contact?.phone ?? ''}</td>
                        <td className="py-2 pr-4">
                          <Badge variant={c.status === 'FAILED' ? 'destructive' : c.status === 'READ' ? 'success' : 'default'}>
                            {c.status}
                          </Badge>
                        </td>
                        <td className="py-2 pr-4 text-xs">{c.sentAt ? new Date(c.sentAt).toLocaleString() : '-'}</td>
                        <td className="py-2 pr-4 text-xs">{c.deliveredAt ? new Date(c.deliveredAt).toLocaleString() : '-'}</td>
                        <td className="py-2 text-xs text-red-500">{c.failReason ?? ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
