'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface Campaign {
  id: string;
  name: string;
  status: string;
}

interface AbTestResult {
  id: string;
  status: string;
  variantA: string;
  variantB: string;
  splitRatio: number;
  winnerId?: string;
  results?: {
    variant: string;
    sent: number;
    delivered: number;
    read: number;
    replied: number;
  }[];
  significance?: {
    pValue: number;
    isSignificant: boolean;
    winner: string;
    message: string;
  };
}

export default function AbTestSetupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const campaignId = searchParams.get('campaignId') ?? '';
  const [variantA, setVariantA] = useState('');
  const [variantB, setVariantB] = useState('');
  const [splitRatio, setSplitRatio] = useState(0.5);

  const { data: campaign } = useQuery({
    queryKey: ['campaign', campaignId],
    queryFn: () => api.get<Campaign>(`/campaigns/${campaignId}`),
    enabled: !!campaignId,
  });

  const { data: existingTest } = useQuery({
    queryKey: ['ab-test', campaignId],
    queryFn: () => api.get<AbTestResult>(`/campaigns/${campaignId}/ab-test`),
    enabled: !!campaignId,
    retry: false,
  });

  const { data: results } = useQuery({
    queryKey: ['ab-test-results', campaignId],
    queryFn: () => api.get<AbTestResult>(`/campaigns/${campaignId}/ab-test/results`),
    enabled: !!existingTest,
    retry: false,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.post(`/campaigns/${campaignId}/ab-test`, {
        variantA,
        variantB,
        splitRatio,
      }),
    onSuccess: () => {
      toast.success('A/B test created');
      router.refresh();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!campaignId) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">A/B Test Setup</h1>
        <p className="text-gray-500">
          Select a campaign first. Go to Campaigns → click a campaign → set up A/B test.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">A/B Test Setup</h1>
      {campaign && (
        <p className="text-gray-500">Campaign: {campaign.name}</p>
      )}

      {/* Existing test results */}
      {results && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Test Results
              <Badge variant={results.status === 'COMPLETED' ? 'success' : 'default'}>
                {results.status}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {results.results?.map((r) => (
                <div
                  key={r.variant}
                  className={`rounded-lg border p-4 ${
                    results.winnerId === r.variant ? 'border-green-500 bg-green-50' : ''
                  }`}
                >
                  <p className="font-semibold text-lg">
                    Variant {r.variant}
                    {results.winnerId === r.variant && ' 🏆'}
                  </p>
                  <p className="text-sm text-gray-500 mb-2">
                    {r.variant === 'A' ? results.variantA : results.variantB}
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>Sent: <span className="font-medium">{r.sent}</span></div>
                    <div>Delivered: <span className="font-medium">{r.delivered}</span></div>
                    <div>Read: <span className="font-medium">{r.read}</span></div>
                    <div>Replied: <span className="font-medium">{r.replied}</span></div>
                    <div className="col-span-2">
                      Read Rate:{' '}
                      <span className="font-medium">
                        {r.delivered > 0
                          ? ((r.read / r.delivered) * 100).toFixed(1)
                          : 0}
                        %
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Significance indicator */}
            {results.significance && (
              <div
                className={`rounded-lg p-4 text-sm ${
                  results.significance.isSignificant
                    ? 'bg-green-50 border border-green-200 text-green-800'
                    : 'bg-gray-50 border border-gray-200 text-gray-700'
                }`}
              >
                <p className="font-medium">{results.significance.message}</p>
                {results.significance.pValue > 0 && (
                  <p className="mt-1 text-xs">p-value: {results.significance.pValue.toFixed(4)}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Create new test form */}
      {!existingTest && (
        <Card>
          <CardHeader>
            <CardTitle>Create A/B Test</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Variant A (Message / Template ID)</label>
              <textarea
                value={variantA}
                onChange={(e) => setVariantA(e.target.value)}
                placeholder="Enter message text or template ID for Variant A..."
                className="mt-1 w-full rounded-lg border px-3 py-2 min-h-[80px]"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Variant B (Message / Template ID)</label>
              <textarea
                value={variantB}
                onChange={(e) => setVariantB(e.target.value)}
                placeholder="Enter message text or template ID for Variant B..."
                className="mt-1 w-full rounded-lg border px-3 py-2 min-h-[80px]"
              />
            </div>
            <div>
              <label className="text-sm font-medium">
                Split Ratio (A: {Math.round(splitRatio * 100)}% / B:{' '}
                {Math.round((1 - splitRatio) * 100)}%)
              </label>
              <input
                type="range"
                min="0.1"
                max="0.9"
                step="0.1"
                value={splitRatio}
                onChange={(e) => setSplitRatio(parseFloat(e.target.value))}
                className="mt-1 w-full"
              />
            </div>
            <button
              onClick={() => createMutation.mutate()}
              disabled={!variantA || !variantB || createMutation.isPending}
              className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {createMutation.isPending ? 'Creating...' : 'Create A/B Test'}
            </button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
