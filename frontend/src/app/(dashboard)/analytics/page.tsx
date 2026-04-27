'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Send, CheckCheck, Eye, XCircle } from 'lucide-react';

interface DailyStat {
  date: string;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  failedCount: number;
}

interface OverviewData {
  dailyStats: DailyStat[];
  totals: { sent: number; delivered: number; read: number; failed: number };
  period: { days: number };
}

export default function AnalyticsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics-overview'],
    queryFn: () => api.get<OverviewData>('/analytics/overview?days=30'),
  });

  const totals = data?.totals ?? { sent: 0, delivered: 0, read: 0, failed: 0 };
  const deliveryRate = totals.sent > 0 ? ((totals.delivered / totals.sent) * 100).toFixed(1) : '0';
  const readRate = totals.delivered > 0 ? ((totals.read / totals.delivered) * 100).toFixed(1) : '0';

  const stats = [
    { label: 'Total Sent', value: totals.sent, icon: Send, color: 'text-blue-600 bg-blue-50' },
    { label: 'Delivered', value: `${totals.delivered} (${deliveryRate}%)`, icon: CheckCheck, color: 'text-green-600 bg-green-50' },
    { label: 'Read', value: `${totals.read} (${readRate}%)`, icon: Eye, color: 'text-purple-600 bg-purple-50' },
    { label: 'Failed', value: totals.failed, icon: XCircle, color: 'text-red-600 bg-red-50' },
  ];

  const dailyStats = data?.dailyStats ?? [];

  // Simple bar chart using divs
  const maxSent = Math.max(1, ...dailyStats.map((d) => d.sentCount));

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Analytics Overview</h1>
      <p className="text-gray-500">Last 30 days performance</p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center gap-4 p-6">
              <div className={`rounded-lg p-3 ${s.color.split(' ')[1]}`}>
                <s.icon className={`h-5 w-5 ${s.color.split(' ')[0]}`} />
              </div>
              <div>
                <p className="text-sm text-gray-500">{s.label}</p>
                <p className="text-2xl font-bold">{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daily Send Volume</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-gray-500">Loading...</p>
          ) : dailyStats.length === 0 ? (
            <p className="text-gray-500">No data for the last 30 days</p>
          ) : (
            <div className="flex items-end gap-1 h-48">
              {dailyStats.map((d) => (
                <div
                  key={d.date}
                  className="flex-1 group relative"
                  title={`${d.date}: ${d.sentCount} sent, ${d.deliveredCount} delivered`}
                >
                  <div
                    className="bg-blue-500 rounded-t transition-all hover:bg-blue-600"
                    style={{ height: `${(d.sentCount / maxSent) * 100}%`, minHeight: d.sentCount > 0 ? '4px' : '0' }}
                  />
                </div>
              ))}
            </div>
          )}
          {dailyStats.length > 0 && (
            <div className="flex justify-between mt-2 text-xs text-gray-400">
              <span>{dailyStats[0]?.date}</span>
              <span>{dailyStats[dailyStats.length - 1]?.date}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
