'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { toast } from 'sonner';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2 } from 'lucide-react';

interface Campaign {
  id: string;
  name: string;
  status: string;
  totalContacts: number;
  sentCount: number;
  deliveredCount: number;
  failedCount: number;
  createdAt: string;
  scheduledAt?: string;
}

const statusVariant: Record<string, 'success' | 'warning' | 'destructive' | 'secondary' | 'default'> = {
  COMPLETED: 'success',
  RUNNING: 'warning',
  DRAFT: 'secondary',
  PAUSED: 'default',
  FAILED: 'destructive',
  SCHEDULED: 'warning',
};

const DELETABLE = ['DRAFT', 'COMPLETED', 'FAILED'];

export default function CampaignsPage() {
  const queryClient = useQueryClient();

  const campaigns = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => api.get<{ data: Campaign[]; total: number }>('/campaigns'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/campaigns/${id}`),
    onSuccess: () => {
      toast.success('Campaign deleted');
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleDelete = (c: Campaign) => {
    if (!confirm(`Delete campaign "${c.name}"? This cannot be undone.`)) return;
    deleteMutation.mutate(c.id);
  };

  const rows = campaigns.data?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Campaigns</h1>
        <Link href="/campaigns/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" /> New Campaign
          </Button>
        </Link>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-4 py-3 text-left font-medium">Name</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Total</th>
                  <th className="px-4 py-3 text-right font-medium">Sent</th>
                  <th className="px-4 py-3 text-right font-medium">Delivered</th>
                  <th className="px-4 py-3 text-right font-medium">Failed</th>
                  <th className="px-4 py-3 text-left font-medium">Created</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className="border-b hover:bg-gray-50 last:border-0">
                    <td className="px-4 py-3">
                      <Link href={`/campaigns/${c.id}`} className="font-medium text-primary hover:underline">
                        {c.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={statusVariant[c.status] ?? 'secondary'}>{c.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">{c.totalContacts}</td>
                    <td className="px-4 py-3 text-right">{c.sentCount}</td>
                    <td className="px-4 py-3 text-right">{c.deliveredCount}</td>
                    <td className="px-4 py-3 text-right">{c.failedCount}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {c.status === 'DRAFT' && (
                          <Link href={`/campaigns/${c.id}/edit`}>
                            <Button variant="ghost" size="sm">
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </Link>
                        )}
                        {DELETABLE.includes(c.status) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => handleDelete(c)}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                      {campaigns.isLoading ? 'Loading...' : 'No campaigns yet'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
