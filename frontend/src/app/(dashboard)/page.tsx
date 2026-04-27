'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Send, Users, FileText, MessageSquare } from 'lucide-react';

interface Campaign {
  id: string;
  name: string;
  status: string;
  totalContacts: number;
  sentCount: number;
  deliveredCount: number;
  failedCount: number;
  createdAt: string;
}

const statusVariant: Record<string, 'success' | 'warning' | 'destructive' | 'secondary' | 'default'> = {
  COMPLETED: 'success',
  RUNNING: 'warning',
  DRAFT: 'secondary',
  PAUSED: 'default',
  FAILED: 'destructive',
};

export default function DashboardPage() {
  const campaigns = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => api.get<{ data: Campaign[]; total: number }>('/campaigns'),
  });

  const contacts = useQuery({
    queryKey: ['contacts-count'],
    queryFn: () => api.get<{ data: unknown[]; total: number }>('/contacts'),
  });

  const templates = useQuery({
    queryKey: ['templates-count'],
    queryFn: () => api.get<unknown[]>('/templates'),
  });

  const sessions = useQuery({
    queryKey: ['sessions'],
    queryFn: () => api.get<unknown[]>('/whatsapp/sessions'),
  });

  const stats = [
    { label: 'Total Campaigns', value: campaigns.data?.total ?? 0, icon: Send, color: 'text-blue-600' },
    { label: 'Contacts', value: contacts.data?.total ?? 0, icon: Users, color: 'text-green-600' },
    { label: 'Templates', value: Array.isArray(templates.data) ? templates.data.length : 0, icon: FileText, color: 'text-purple-600' },
    { label: 'WA Sessions', value: Array.isArray(sessions.data) ? sessions.data.length : 0, icon: MessageSquare, color: 'text-brand-600' },
  ];

  const recentCampaigns = campaigns.data?.data?.slice(0, 5) ?? [];

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Dashboard</h1>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center gap-4 p-6">
              <div className={`rounded-lg bg-gray-100 p-3 ${stat.color}`}>
                <stat.icon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="text-2xl font-bold">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Campaigns */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Campaigns</CardTitle>
        </CardHeader>
        <CardContent>
          {recentCampaigns.length === 0 ? (
            <p className="text-muted-foreground text-sm">No campaigns yet. Create your first campaign!</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="pb-2 text-left font-medium">Name</th>
                    <th className="pb-2 text-left font-medium">Status</th>
                    <th className="pb-2 text-right font-medium">Sent</th>
                    <th className="pb-2 text-right font-medium">Delivered</th>
                    <th className="pb-2 text-right font-medium">Failed</th>
                  </tr>
                </thead>
                <tbody>
                  {recentCampaigns.map((c) => (
                    <tr key={c.id} className="border-b last:border-0">
                      <td className="py-3 font-medium">{c.name}</td>
                      <td className="py-3">
                        <Badge variant={statusVariant[c.status] ?? 'secondary'}>{c.status}</Badge>
                      </td>
                      <td className="py-3 text-right">{c.sentCount}</td>
                      <td className="py-3 text-right">{c.deliveredCount}</td>
                      <td className="py-3 text-right">{c.failedCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
