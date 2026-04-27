'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { UserPlus, Trash2 } from 'lucide-react';

interface TeamMember {
  userId: string;
  role: 'ADMIN' | 'AGENT' | 'VIEWER';
  user: { id: string; name: string; email: string };
  createdAt: string;
}

const roles = ['ADMIN', 'AGENT', 'VIEWER'] as const;

export default function TeamPage() {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<string>('AGENT');

  const { data: members = [] } = useQuery({
    queryKey: ['team-members'],
    queryFn: () => api.get<TeamMember[]>('/teams/members'),
  });

  const inviteMutation = useMutation({
    mutationFn: () => api.post('/teams/members', { email, role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      setEmail('');
      toast.success('Team member invited');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      api.patch(`/teams/members/${userId}`, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      toast.success('Role updated');
    },
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) => api.delete(`/teams/members/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      toast.success('Member removed');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Team Settings</h1>

      <Card>
        <CardContent className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">Invite Member</h2>
          <div className="flex gap-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              className="flex-1 rounded-lg border px-3 py-2"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="rounded-lg border px-3 py-2"
            >
              {roles.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <button
              onClick={() => inviteMutation.mutate()}
              disabled={!email || inviteMutation.isPending}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <UserPlus className="h-4 w-4" />
              Invite
            </button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold mb-4">Members</h2>
          <div className="space-y-3">
            {members.map((m) => (
              <div key={m.userId} className="flex items-center justify-between border-b pb-3 last:border-0">
                <div>
                  <p className="font-medium">{m.user?.name ?? 'Unknown'}</p>
                  <p className="text-sm text-gray-500">{m.user?.email}</p>
                </div>
                <div className="flex items-center gap-3">
                  <select
                    value={m.role}
                    onChange={(e) =>
                      updateRoleMutation.mutate({ userId: m.userId, role: e.target.value })
                    }
                    className="rounded border px-2 py-1 text-sm"
                  >
                    {roles.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => {
                      if (confirm('Remove this member?')) removeMutation.mutate(m.userId);
                    }}
                    className="p-2 rounded hover:bg-red-50 text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
            {members.length === 0 && (
              <p className="text-center text-gray-500 py-4">No team members yet.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
