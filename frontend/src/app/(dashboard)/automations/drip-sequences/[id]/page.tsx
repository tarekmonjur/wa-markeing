'use client';

import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowDown, Users } from 'lucide-react';
import Link from 'next/link';

interface DripStep {
  id: string;
  stepNumber: number;
  templateId: string;
  delayHours: number;
  condition: string;
  template?: { name: string };
}

interface DripEnrollment {
  id: string;
  contactId: string;
  currentStep: number;
  status: string;
  enrolledAt: string;
  completedAt?: string;
  contact?: { name?: string; phone: string };
}

interface DripSequence {
  id: string;
  name: string;
  isActive: boolean;
  steps: DripStep[];
  enrollments: DripEnrollment[];
}

export default function DripSequenceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: sequence, isLoading } = useQuery({
    queryKey: ['drip-sequences', id],
    queryFn: () => api.get<DripSequence>(`/drip-sequences/${id}`),
  });

  const toggleMutation = useMutation({
    mutationFn: (isActive: boolean) =>
      api.patch(`/drip-sequences/${id}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drip-sequences', id] });
    },
  });

  if (isLoading) {
    return <div className="text-center py-12 text-muted-foreground">Loading...</div>;
  }

  if (!sequence) {
    return <div className="text-center py-12 text-destructive">Sequence not found</div>;
  }

  const steps = [...(sequence.steps ?? [])].sort((a, b) => a.stepNumber - b.stepNumber);
  const enrollments = sequence.enrollments ?? [];
  const activeCount = enrollments.filter((e) => e.status === 'ACTIVE').length;
  const completedCount = enrollments.filter((e) => e.status === 'COMPLETED').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{sequence.name}</h1>
          <p className="text-muted-foreground mt-1">
            {steps.length} steps · {enrollments.length} total enrollments
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => toggleMutation.mutate(!sequence.isActive)}
          >
            {sequence.isActive ? 'Deactivate' : 'Activate'}
          </Button>
          <Link href="/automations/drip-sequences">
            <Button variant="outline">Back</Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-3">
        <Card>
          <CardContent className="py-4 text-center">
            <div className="text-2xl font-bold">{activeCount}</div>
            <div className="text-xs text-muted-foreground">Active</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <div className="text-2xl font-bold">{completedCount}</div>
            <div className="text-xs text-muted-foreground">Completed</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <div className="text-2xl font-bold">
              {enrollments.length > 0
                ? Math.round((completedCount / enrollments.length) * 100)
                : 0}%
            </div>
            <div className="text-xs text-muted-foreground">Completion Rate</div>
          </CardContent>
        </Card>
      </div>

      {/* Step Chain */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Step Chain</h2>
        <div className="space-y-1">
          {steps.map((step, idx) => {
            const atStep = enrollments.filter(
              (e) => e.status === 'ACTIVE' && e.currentStep === step.stepNumber,
            ).length;

            return (
              <div key={step.id}>
                {idx > 0 && (
                  <div className="flex items-center justify-center py-1">
                    <ArrowDown className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground ml-1">
                      +{step.delayHours}h
                    </span>
                  </div>
                )}
                <Card>
                  <CardContent className="py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-brand-700 font-bold text-sm">
                        {step.stepNumber}
                      </div>
                      <div>
                        <span className="text-sm font-medium">
                          {step.template?.name ?? `Template ${step.templateId.slice(0, 8)}`}
                        </span>
                        <Badge variant="secondary" className="ml-2 text-xs">
                          {step.condition}
                        </Badge>
                      </div>
                    </div>
                    {atStep > 0 && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Users className="h-3 w-3" />
                        {atStep} waiting
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      </div>

      {/* Enrollments */}
      {enrollments.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Enrollments</h2>
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Contact</th>
                    <th className="px-4 py-2 text-left font-medium">Current Step</th>
                    <th className="px-4 py-2 text-left font-medium">Status</th>
                    <th className="px-4 py-2 text-left font-medium">Enrolled</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {enrollments.map((enr) => (
                    <tr key={enr.id}>
                      <td className="px-4 py-2">
                        {enr.contact?.name ?? enr.contact?.phone ?? enr.contactId.slice(0, 8)}
                      </td>
                      <td className="px-4 py-2">{enr.currentStep}</td>
                      <td className="px-4 py-2">
                        <Badge
                          variant={
                            enr.status === 'COMPLETED'
                              ? 'success'
                              : enr.status === 'ACTIVE'
                                ? 'warning'
                                : 'secondary'
                          }
                        >
                          {enr.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {new Date(enr.enrolledAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
