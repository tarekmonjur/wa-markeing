'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { CalendarDays, Plus, Trash2, Power, PowerOff } from 'lucide-react';

interface DateAutomation {
  id: string;
  fieldName: string;
  sendTime: string;
  isActive: boolean;
  sessionId: string;
  templateId: string;
  template?: { name: string; body: string };
  createdAt: string;
}

export default function DateBasedPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    sessionId: '',
    templateId: '',
    fieldName: 'birthday',
    sendTime: '09:00',
  });

  const { data: automations, isLoading } = useQuery({
    queryKey: ['date-automations'],
    queryFn: () => api.get<DateAutomation[]>('/automations/date'),
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof form) => api.post('/automations/date', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['date-automations'] });
      setShowForm(false);
      setForm({ sessionId: '', templateId: '', fieldName: 'birthday', sendTime: '09:00' });
      toast.success('Automation created');
    },
    onError: () => toast.error('Failed to create automation'),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/automations/date/${id}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['date-automations'] });
      toast.success('Automation updated');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/automations/date/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['date-automations'] });
      toast.success('Automation deleted');
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Date-Based Automations</h1>
          <p className="text-muted-foreground">
            Send automatic messages on birthdays, anniversaries, and other dates
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-2" />
          New Automation
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create Automation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Session ID</Label>
                <Input
                  value={form.sessionId}
                  onChange={(e) =>
                    setForm({ ...form, sessionId: e.target.value })
                  }
                  placeholder="WhatsApp session UUID"
                />
              </div>
              <div>
                <Label>Template ID</Label>
                <Input
                  value={form.templateId}
                  onChange={(e) =>
                    setForm({ ...form, templateId: e.target.value })
                  }
                  placeholder="Message template UUID"
                />
              </div>
              <div>
                <Label>Date Field Name</Label>
                <Input
                  value={form.fieldName}
                  onChange={(e) =>
                    setForm({ ...form, fieldName: e.target.value })
                  }
                  placeholder="e.g. birthday, anniversary"
                />
              </div>
              <div>
                <Label>Send Time (HH:mm)</Label>
                <Input
                  value={form.sendTime}
                  onChange={(e) =>
                    setForm({ ...form, sendTime: e.target.value })
                  }
                  placeholder="09:00"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => createMutation.mutate(form)}
                disabled={createMutation.isPending}
              >
                Create
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Active Automations
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-4 text-muted-foreground">
              Loading...
            </div>
          ) : !automations?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              No date automations configured yet
            </div>
          ) : (
            <div className="space-y-3">
              {automations.map((auto) => (
                <div
                  key={auto.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div>
                    <div className="font-medium capitalize">
                      {auto.fieldName} Automation
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Sends at {auto.sendTime} &bull;{' '}
                      {auto.template?.name || 'Template'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={auto.isActive ? 'success' : 'secondary'}
                    >
                      {auto.isActive ? 'Active' : 'Paused'}
                    </Badge>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() =>
                        toggleMutation.mutate({
                          id: auto.id,
                          isActive: !auto.isActive,
                        })
                      }
                    >
                      {auto.isActive ? (
                        <PowerOff className="h-4 w-4" />
                      ) : (
                        <Power className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        if (confirm('Delete this automation?')) {
                          deleteMutation.mutate(auto.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
