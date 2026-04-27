'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { toast } from 'sonner';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, FolderPlus, Users, Trash2, Eye } from 'lucide-react';

interface Group {
  id: string;
  name: string;
  createdAt: string;
}

export default function GroupsPage() {
  const [newGroupName, setNewGroupName] = useState('');
  const queryClient = useQueryClient();

  const groups = useQuery({
    queryKey: ['groups'],
    queryFn: () => api.get<Group[]>('/contacts/groups'),
  });

  const createMutation = useMutation({
    mutationFn: (name: string) => api.post<Group>('/contacts/groups', { name }),
    onSuccess: (data) => {
      toast.success(`Group "${data.name}" created`);
      setNewGroupName('');
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (groupId: string) => api.delete(`/contacts/groups/${groupId}`),
    onSuccess: () => {
      toast.success('Group deleted');
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const groupList = Array.isArray(groups.data) ? groups.data : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/contacts">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">Contact Groups</h1>
      </div>

      {/* Create group */}
      <Card>
        <CardContent className="pt-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (newGroupName.trim()) createMutation.mutate(newGroupName.trim());
            }}
            className="flex gap-3"
          >
            <Input
              placeholder="Enter group name..."
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              className="max-w-sm"
            />
            <Button type="submit" disabled={!newGroupName.trim() || createMutation.isPending}>
              <FolderPlus className="mr-2 h-4 w-4" />
              {createMutation.isPending ? 'Creating...' : 'Create Group'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Group list */}
      {groups.isLoading ? (
        <p className="text-muted-foreground">Loading groups...</p>
      ) : groupList.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="mx-auto h-12 w-12 text-muted-foreground/50 mb-3" />
            <p className="text-lg font-medium">No groups yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Create a group above to organize contacts for campaigns.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {groupList.map((g) => (
            <Card key={g.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <h3 className="font-semibold text-lg">{g.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      Created {new Date(g.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant="outline">
                    <Users className="mr-1 h-3 w-3" />
                    Group
                  </Badge>
                </div>
                <div className="mt-4 flex gap-2">
                  <Link href={`/contacts/groups/${g.id}`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full">
                      <Eye className="mr-1 h-3 w-3" />
                      View / Edit
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => {
                      if (confirm(`Delete group "${g.name}"?`)) {
                        deleteMutation.mutate(g.id);
                      }
                    }}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
