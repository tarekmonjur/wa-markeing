'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Clock, Save } from 'lucide-react';

interface Settings {
  timezone: string;
  sendWindowStart: number;
  sendWindowEnd: number;
  sendDaysOfWeek: number[];
  smartSendEnabled: boolean;
}

const DAYS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 7, label: 'Sun' },
];

export default function SendWindowPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Settings | null>(null);

  const { isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get<Settings>('/settings'),
    onSuccess: (data: Settings) => setForm(data),
  });

  const mutation = useMutation({
    mutationFn: (data: Partial<Settings>) => api.patch('/settings', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success('Settings saved');
    },
    onError: () => toast.error('Failed to save settings'),
  });

  if (isLoading || !form) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const toggleDay = (day: number) => {
    setForm((prev) => {
      if (!prev) return prev;
      const days = prev.sendDaysOfWeek.includes(day)
        ? prev.sendDaysOfWeek.filter((d) => d !== day)
        : [...prev.sendDaysOfWeek, day];
      return { ...prev, sendDaysOfWeek: days };
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Smart Send Window</h1>
        <p className="text-muted-foreground">
          Configure business hours for message delivery
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Send Window Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="smart-send"
              checked={form.smartSendEnabled}
              onChange={(e) =>
                setForm({ ...form, smartSendEnabled: e.target.checked })
              }
              className="h-4 w-4"
            />
            <Label htmlFor="smart-send">
              Enable Smart Send (defer messages outside business hours)
            </Label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Timezone</Label>
              <Input
                value={form.timezone}
                onChange={(e) =>
                  setForm({ ...form, timezone: e.target.value })
                }
                placeholder="e.g. Asia/Dhaka"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Window Start (hour, 0-23)</Label>
              <Input
                type="number"
                min={0}
                max={23}
                value={form.sendWindowStart}
                onChange={(e) =>
                  setForm({
                    ...form,
                    sendWindowStart: parseInt(e.target.value) || 0,
                  })
                }
              />
            </div>
            <div>
              <Label>Window End (hour, 0-23)</Label>
              <Input
                type="number"
                min={0}
                max={23}
                value={form.sendWindowEnd}
                onChange={(e) =>
                  setForm({
                    ...form,
                    sendWindowEnd: parseInt(e.target.value) || 0,
                  })
                }
              />
            </div>
          </div>

          <div>
            <Label className="mb-2 block">Send Days</Label>
            <div className="flex gap-2 flex-wrap">
              {DAYS.map((day) => (
                <button
                  key={day.value}
                  onClick={() => toggleDay(day.value)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    form.sendDaysOfWeek.includes(day.value)
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </div>

          <Button
            onClick={() => mutation.mutate(form)}
            disabled={mutation.isPending}
          >
            <Save className="h-4 w-4 mr-2" />
            Save Settings
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
