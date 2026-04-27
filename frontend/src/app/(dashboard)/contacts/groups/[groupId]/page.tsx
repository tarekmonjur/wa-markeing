'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Save, UserPlus, X, Search, Check } from 'lucide-react';

interface Contact {
  id: string;
  name: string;
  phone: string;
  email?: string;
  optedOut: boolean;
  customFields: Record<string, unknown>;
}

interface Group {
  id: string;
  name: string;
  createdAt: string;
  contacts: Contact[];
}

export default function GroupDetailPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [editName, setEditName] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Fetch group with contacts
  const group = useQuery({
    queryKey: ['group', groupId],
    queryFn: () => api.get<Group>(`/contacts/groups/${groupId}`),
    enabled: !!groupId,
  });

  // Fetch all contacts for the picker
  const allContacts = useQuery({
    queryKey: ['contacts', 'all'],
    queryFn: () => api.get<{ data: Contact[]; total: number }>('/contacts?page=1&limit=500'),
    enabled: showPicker,
  });

  // Update group name
  const updateMutation = useMutation({
    mutationFn: (name: string) => api.patch<Group>(`/contacts/groups/${groupId}`, { name }),
    onSuccess: (data) => {
      toast.success(`Group renamed to "${data.name}"`);
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ['group', groupId] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Add contacts to group
  const addMutation = useMutation({
    mutationFn: (contactIds: string[]) =>
      api.post<Group>(`/contacts/groups/${groupId}/contacts`, { contactIds }),
    onSuccess: () => {
      toast.success('Contacts added to group');
      setShowPicker(false);
      setSelectedIds(new Set());
      setPickerSearch('');
      queryClient.invalidateQueries({ queryKey: ['group', groupId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Remove contact from group
  const removeMutation = useMutation({
    mutationFn: (contactIds: string[]) =>
      api.post<Group>(`/contacts/groups/${groupId}/remove-contacts`, { contactIds }),
    onSuccess: () => {
      toast.success('Contact removed from group');
      queryClient.invalidateQueries({ queryKey: ['group', groupId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const groupData = group.data;
  const groupContacts = groupData?.contacts ?? [];
  const memberIds = new Set(groupContacts.map((c) => c.id));

  // Filter all contacts for the picker (exclude already-in-group)
  const availableContacts = (allContacts.data?.data ?? [])
    .filter((c) => !memberIds.has(c.id))
    .filter(
      (c) =>
        !pickerSearch ||
        c.name?.toLowerCase().includes(pickerSearch.toLowerCase()) ||
        c.phone.includes(pickerSearch),
    );

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (group.isLoading) return <p className="text-muted-foreground p-6">Loading...</p>;
  if (!groupData) return <p className="text-destructive p-6">Group not found</p>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/contacts/groups">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        {isEditing ? (
          <div className="flex items-center gap-2">
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="max-w-xs text-lg font-bold"
              autoFocus
            />
            <Button
              size="sm"
              onClick={() => editName.trim() && updateMutation.mutate(editName.trim())}
              disabled={updateMutation.isPending}
            >
              <Save className="mr-1 h-3 w-3" />
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{groupData.name}</h1>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditName(groupData.name);
                setIsEditing(true);
              }}
            >
              Rename
            </Button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="flex gap-4">
        <Badge variant="outline" className="text-sm px-3 py-1">
          {groupContacts.length} contact{groupContacts.length !== 1 ? 's' : ''}
        </Badge>
        <Badge variant="outline" className="text-sm px-3 py-1">
          Created {new Date(groupData.createdAt).toLocaleDateString()}
        </Badge>
      </div>

      {/* Add contacts button */}
      <div>
        {!showPicker ? (
          <Button onClick={() => setShowPicker(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Add Contacts
          </Button>
        ) : (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Select Contacts to Add</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => { setShowPicker(false); setSelectedIds(new Set()); setPickerSearch(''); }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name or phone..."
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              {allContacts.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading contacts...</p>
              ) : availableContacts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {pickerSearch ? 'No matching contacts found' : 'All contacts are already in this group'}
                </p>
              ) : (
                <div className="max-h-64 overflow-y-auto border rounded-lg">
                  {availableContacts.map((c) => (
                    <label
                      key={c.id}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer border-b last:border-0"
                    >
                      <div
                        className={`h-5 w-5 rounded border flex items-center justify-center transition-colors ${
                          selectedIds.has(c.id) ? 'bg-primary border-primary text-white' : 'border-gray-300'
                        }`}
                        onClick={() => toggleSelect(c.id)}
                      >
                        {selectedIds.has(c.id) && <Check className="h-3 w-3" />}
                      </div>
                      <div className="flex-1 min-w-0" onClick={() => toggleSelect(c.id)}>
                        <p className="text-sm font-medium truncate">{c.name || 'Unnamed'}</p>
                        <p className="text-xs text-muted-foreground font-mono">{c.phone}</p>
                      </div>
                      {c.optedOut && <Badge variant="destructive" className="text-xs">Opted Out</Badge>}
                    </label>
                  ))}
                </div>
              )}

              {selectedIds.size > 0 && (
                <div className="flex items-center gap-3 pt-1">
                  <Button onClick={() => addMutation.mutate(Array.from(selectedIds))} disabled={addMutation.isPending}>
                    {addMutation.isPending ? 'Adding...' : `Add ${selectedIds.size} Contact${selectedIds.size > 1 ? 's' : ''}`}
                  </Button>
                  <span className="text-sm text-muted-foreground">{selectedIds.size} selected</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Group members */}
      <Card>
        <CardHeader>
          <CardTitle>Group Members</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {groupContacts.length === 0 ? (
            <p className="px-6 py-8 text-center text-muted-foreground">
              No contacts in this group yet. Click "Add Contacts" above to get started.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="px-4 py-3 text-left font-medium">Name</th>
                    <th className="px-4 py-3 text-left font-medium">Phone</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-left font-medium">City</th>
                    <th className="px-4 py-3 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {groupContacts.map((c) => (
                    <tr key={c.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <Link href={`/contacts/${c.id}`} className="font-medium text-primary hover:underline">
                          {c.name || '—'}
                        </Link>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{c.phone}</td>
                      <td className="px-4 py-3">
                        <Badge variant={c.optedOut ? 'destructive' : 'success'}>
                          {c.optedOut ? 'Opted Out' : 'Active'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">{(c.customFields?.city as string) || '—'}</td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => {
                            if (confirm(`Remove "${c.name || c.phone}" from this group?`)) {
                              removeMutation.mutate([c.id]);
                            }
                          }}
                          disabled={removeMutation.isPending}
                        >
                          <X className="h-3 w-3 mr-1" />
                          Remove
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
