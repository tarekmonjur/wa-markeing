'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Trash2, ArrowDown } from 'lucide-react';

interface Template {
  id: string;
  name: string;
}

interface StepInput {
  stepNumber: number;
  templateId: string;
  delayHours: number;
  condition: string;
}

export default function NewDripSequencePage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [steps, setSteps] = useState<StepInput[]>([
    { stepNumber: 1, templateId: '', delayHours: 0, condition: 'ALWAYS' },
  ]);

  const { data: templates = [] } = useQuery({
    queryKey: ['templates'],
    queryFn: () => api.get<Template[]>('/templates'),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/drip-sequences', data),
    onSuccess: () => {
      toast.success('Drip sequence created');
      router.push('/automations/drip-sequences');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const addStep = () => {
    setSteps([
      ...steps,
      {
        stepNumber: steps.length + 1,
        templateId: '',
        delayHours: 24,
        condition: 'ALWAYS',
      },
    ]);
  };

  const removeStep = (index: number) => {
    const updated = steps.filter((_, i) => i !== index).map((s, i) => ({
      ...s,
      stepNumber: i + 1,
    }));
    setSteps(updated);
  };

  const updateStep = (index: number, field: string, value: any) => {
    const updated = [...steps];
    (updated[index] as any)[field] = value;
    setSteps(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }
    if (steps.some((s) => !s.templateId)) {
      toast.error('All steps must have a template');
      return;
    }
    createMutation.mutate({ name, steps });
  };

  const templateList = Array.isArray(templates) ? templates : [];

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">New Drip Sequence</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardContent className="pt-6">
            <label className="block text-sm font-medium mb-1">Sequence Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., New Customer Onboarding"
              className="w-full rounded border px-3 py-2 text-sm"
              required
            />
          </CardContent>
        </Card>

        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Steps</h2>

          {steps.map((step, idx) => (
            <div key={idx}>
              {idx > 0 && (
                <div className="flex items-center justify-center py-2">
                  <ArrowDown className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground ml-1">
                    +{step.delayHours}h delay
                  </span>
                </div>
              )}
              <Card>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-medium text-sm">
                      Step {step.stepNumber}
                    </span>
                    {steps.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-destructive h-7 w-7"
                        onClick={() => removeStep(idx)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <label className="block text-xs font-medium mb-1">Template</label>
                      <select
                        value={step.templateId}
                        onChange={(e) => updateStep(idx, 'templateId', e.target.value)}
                        className="w-full rounded border px-2 py-1.5 text-sm"
                        required
                      >
                        <option value="">Select...</option>
                        {templateList.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">
                        Delay (hours)
                      </label>
                      <input
                        type="number"
                        value={step.delayHours}
                        onChange={(e) =>
                          updateStep(idx, 'delayHours', Number(e.target.value))
                        }
                        min={0}
                        className="w-full rounded border px-2 py-1.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Condition</label>
                      <select
                        value={step.condition}
                        onChange={(e) => updateStep(idx, 'condition', e.target.value)}
                        className="w-full rounded border px-2 py-1.5 text-sm"
                      >
                        <option value="ALWAYS">Always</option>
                        <option value="NO_REPLY">No Reply</option>
                        <option value="REPLIED">Replied</option>
                      </select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}

          <Button type="button" variant="outline" onClick={addStep} className="w-full">
            <Plus className="mr-2 h-4 w-4" /> Add Step
          </Button>
        </div>

        <div className="flex gap-3">
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Creating...' : 'Create Sequence'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/automations/drip-sequences')}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
