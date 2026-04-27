'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CreditCard, TrendingUp } from 'lucide-react';

interface UsageData {
  plan: string;
  limits: Record<string, number | boolean>;
  usage: {
    contactCount: number;
    sessionsCount: number;
    campaignsThisMonth: number;
    messagesToday: number;
    aiGenerationsToday: number;
  };
}

function UsageBar({
  label,
  used,
  max,
}: {
  label: string;
  used: number;
  max: number;
}) {
  const isUnlimited = max === -1;
  const percentage = isUnlimited ? 0 : Math.min((used / max) * 100, 100);
  const color =
    percentage >= 95
      ? 'bg-red-500'
      : percentage >= 80
        ? 'bg-yellow-500'
        : 'bg-emerald-500';

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">
          {used.toLocaleString()} / {isUnlimited ? '∞' : max.toLocaleString()}
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: isUnlimited ? '0%' : `${percentage}%` }}
        />
      </div>
    </div>
  );
}

export default function PlanPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['billing', 'usage'],
    queryFn: () => api.get<UsageData>('/billing/usage'),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!data) return null;

  const planBadgeVariant =
    data.plan === 'FREE'
      ? 'secondary'
      : data.plan === 'STARTER'
        ? 'default'
        : 'success';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Subscription Plan</h1>
          <p className="text-muted-foreground">
            Manage your plan and view usage
          </p>
        </div>
        <Badge variant={planBadgeVariant as any} className="text-lg px-4 py-1">
          {data.plan}
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Usage Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <UsageBar
              label="Contacts"
              used={data.usage.contactCount}
              max={data.limits.maxContacts as number}
            />
            <UsageBar
              label="Sessions"
              used={data.usage.sessionsCount}
              max={data.limits.maxSessions as number}
            />
            <UsageBar
              label="Campaigns (this month)"
              used={data.usage.campaignsThisMonth}
              max={data.limits.maxCampaignsPerMonth as number}
            />
            <UsageBar
              label="Messages (today)"
              used={data.usage.messagesToday}
              max={data.limits.maxMessagesPerDay as number}
            />
            <UsageBar
              label="AI Generations (today)"
              used={data.usage.aiGenerationsToday}
              max={data.limits.aiGenerationsPerDay as number}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Plan Features
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: 'Webhooks', enabled: data.limits.canUseWebhooks },
              { label: 'REST API', enabled: data.limits.canUseApi },
              { label: 'Auto-Reply', enabled: data.limits.canUseAutoReply },
              { label: 'Drip Sequences', enabled: data.limits.canUseDrip },
            ].map((feature) => (
              <div
                key={feature.label}
                className="flex items-center justify-between"
              >
                <span className="text-sm">{feature.label}</span>
                <Badge variant={feature.enabled ? 'success' : 'secondary'}>
                  {feature.enabled ? 'Included' : 'Upgrade'}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {data.plan === 'FREE' && (
        <Card className="border-primary">
          <CardContent className="pt-6 text-center">
            <h3 className="text-lg font-semibold mb-2">
              Upgrade to unlock more features
            </h3>
            <p className="text-muted-foreground mb-4">
              Get more contacts, sessions, and premium features like API access
              and drip sequences.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
