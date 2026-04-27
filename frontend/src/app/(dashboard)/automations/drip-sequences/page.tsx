'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, GitBranch } from 'lucide-react';
import Link from 'next/link';

interface DripSequence {
  id: string;
  name: string;
  isActive: boolean;
  steps: any[];
  enrollments: any[];
  createdAt: string;
}

export default function DripSequencesPage() {
  const queryClient = useQueryClient();

  const { data: sequences = [], isLoading } = useQuery({
    queryKey: ['drip-sequences'],
    queryFn: () => api.get<DripSequence[]>('/drip-sequences'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/drip-sequences/${id}`),
    onSuccess: () => {
      toast.success('Sequence deleted');
      queryClient.invalidateQueries({ queryKey: ['drip-sequences'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const seqList = Array.isArray(sequences) ? sequences : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Drip Sequences</h1>
          <p className="text-muted-foreground mt-1">
            Automated message sequences over time
          </p>
        </div>
        <Link href="/automations/drip-sequences/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" /> New Sequence
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : seqList.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12">
            <GitBranch className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No drip sequences</p>
            <p className="text-muted-foreground text-sm mt-1">
              Create a sequence to send automated messages over time.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {seqList.map((seq) => {
            const activeEnrollments = seq.enrollments?.filter(
              (e: any) => e.status === 'ACTIVE',
            ).length ?? 0;
            const completedEnrollments = seq.enrollments?.filter(
              (e: any) => e.status === 'COMPLETED',
            ).length ?? 0;

            return (
              <Card key={seq.id}>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between mb-2">
                    <Link
                      href={`/automations/drip-sequences/${seq.id}`}
                      className="font-medium hover:underline"
                    >
                      {seq.name}
                    </Link>
                    <Badge variant={seq.isActive ? 'success' : 'secondary'}>
                      {seq.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <div className="flex justify-between">
                      <span>Steps</span>
                      <span>{seq.steps?.length ?? 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Active enrollments</span>
                      <span>{activeEnrollments}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Completed</span>
                      <span>{completedEnrollments}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Link href={`/automations/drip-sequences/${seq.id}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full">
                        View
                      </Button>
                    </Link>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive"
                      onClick={() => deleteMutation.mutate(seq.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
