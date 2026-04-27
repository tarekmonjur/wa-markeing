'use client';

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { toast } from 'sonner';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Upload, Plus, Search, FolderOpen, Pencil, Trash2 } from 'lucide-react';

interface Contact {
  id: string;
  name: string;
  phone: string;
  email?: string;
  optedOut: boolean;
  customFields: Record<string, unknown>;
  createdAt: string;
}

export default function ContactsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const fileRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const contacts = useQuery({
    queryKey: ['contacts', page, search],
    queryFn: () =>
      api.get<{ data: Contact[]; total: number }>(
        `/contacts?page=${page}&limit=20${search ? `&search=${encodeURIComponent(search)}` : ''}`,
      ),
  });

  const importMutation = useMutation({
    mutationFn: (file: File) => api.upload<{ imported: number; updated: number; skipped: number; errors: string[] }>('/contacts/import/csv', file),
    onSuccess: (data) => {
      toast.success(`Imported ${data.imported} contacts, updated ${data.updated}, skipped ${data.skipped}`);
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/contacts/${id}`),
    onSuccess: () => {
      toast.success('Contact deleted');
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) importMutation.mutate(file);
    e.target.value = '';
  };

  const handleDelete = (c: Contact) => {
    if (!confirm(`Delete contact "${c.name || c.phone}"? This cannot be undone.`)) return;
    deleteMutation.mutate(c.id);
  };

  const total = contacts.data?.total ?? 0;
  const rows = contacts.data?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Contacts</h1>
        <div className="flex gap-2">
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
          <Link href="/contacts/groups">
            <Button variant="outline">
              <FolderOpen className="mr-2 h-4 w-4" />
              Groups
            </Button>
          </Link>
          <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={importMutation.isPending}>
            <Upload className="mr-2 h-4 w-4" />
            {importMutation.isPending ? 'Importing...' : 'Import CSV'}
          </Button>
          <Link href="/contacts/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Contact
            </Button>
          </Link>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search contacts..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-4 py-3 text-left font-medium">Name</th>
                  <th className="px-4 py-3 text-left font-medium">Phone</th>
                  <th className="px-4 py-3 text-left font-medium">Email</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">City</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className="border-b hover:bg-gray-50 last:border-0">
                    <td className="px-4 py-3">
                      <Link href={`/contacts/${c.id}`} className="font-medium text-primary hover:underline">
                        {c.name || '—'}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{c.phone}</td>
                    <td className="px-4 py-3">{c.email || '—'}</td>
                    <td className="px-4 py-3">
                      <Badge variant={c.optedOut ? 'destructive' : 'success'}>
                        {c.optedOut ? 'Opted Out' : 'Active'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">{(c.customFields?.city as string) || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/contacts/${c.id}/edit`}>
                          <Button variant="ghost" size="sm">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => handleDelete(c)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      {contacts.isLoading ? 'Loading...' : 'No contacts found'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {total > 20 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} of {total}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page * 20 >= total} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}
