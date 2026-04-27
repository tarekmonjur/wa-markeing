'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { Sparkles, Copy, Check } from 'lucide-react';

interface AiResult {
  copy: string;
  provider: string;
  remaining: number;
}

export default function AiGeneratorPage() {
  const [businessName, setBusinessName] = useState('');
  const [product, setProduct] = useState('');
  const [goal, setGoal] = useState('');
  const [tone, setTone] = useState('friendly');
  const [result, setResult] = useState<AiResult | null>(null);
  const [copied, setCopied] = useState(false);

  const mutation = useMutation({
    mutationFn: () =>
      api.post<AiResult>('/ai/generate', { businessName, product, goal, tone }),
    onSuccess: (data) => {
      setResult(data);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleCopy = async () => {
    if (!result?.copy) return;
    await navigator.clipboard.writeText(result.copy);
    setCopied(true);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Sparkles className="h-7 w-7 text-purple-600" />
          AI Copy Generator
        </h1>
        <p className="text-gray-500 mt-1">Generate WhatsApp marketing copy using AI</p>
      </div>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Business Name</label>
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="e.g. Rahim Garments"
              className="mt-1 w-full rounded-lg border px-3 py-2"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Product / Service</label>
            <input
              type="text"
              value={product}
              onChange={(e) => setProduct(e.target.value)}
              placeholder="e.g. Summer collection kurtis"
              className="mt-1 w-full rounded-lg border px-3 py-2"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Goal</label>
            <input
              type="text"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="e.g. Announce 20% Eid discount"
              className="mt-1 w-full rounded-lg border px-3 py-2"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Tone</label>
            <select
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2"
            >
              <option value="friendly">Friendly</option>
              <option value="professional">Professional</option>
              <option value="urgent">Urgent</option>
              <option value="casual">Casual</option>
              <option value="excited">Excited</option>
            </select>
          </div>

          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !businessName || !product || !goal}
            className="w-full rounded-lg bg-purple-600 px-4 py-2.5 text-white font-medium hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {mutation.isPending ? (
              'Generating...'
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generate Copy
              </>
            )}
          </button>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Generated Copy</CardTitle>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400">
                  via {result.provider} · {result.remaining} remaining today
                </span>
                <button
                  onClick={handleCopy}
                  className="p-2 rounded-lg hover:bg-gray-100"
                  title="Copy to clipboard"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4 text-gray-500" />
                  )}
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg bg-gray-50 p-4 text-lg leading-relaxed">
              {result.copy}
            </div>
            <p className="mt-2 text-xs text-gray-400">
              {result.copy.length} characters
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
