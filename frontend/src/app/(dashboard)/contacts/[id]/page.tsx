'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Ban, Pencil, Trash2 } from 'lucide-react';

interface Contact {
  id: string;
  name: string;
  phone: string;
  email?: string;
  optedOut: boolean;
  optedOutAt?: string;
  customFields: Record<string, unknown>;
  createdAt: string;
}

export default function ContactDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = params.id as string;

  const { data: contact, isLoading } = useQuery({
    queryKey: ['contact', id],
    queryFn: () => api.get<Contact>(`/contacts/${id}`),
  });

  const optOutMutation = useMutation({
    mutationFn: () => api.patch(`/contacts/${id}/opt-out`),
    onSuccess: () => {
      toast.success('Contact opted out');
      queryClient.invalidateQueries({ queryKey: ['contact', id] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/contacts/${id}`),
    onSuccess: () => {
      toast.success('Contact deleted');
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      router.push('/contacts');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleDelete = () => {
    if (!confirm(`Delete contact "${contact?.name || contact?.phone}"? This cannot be undone.`)) return;
    deleteMutation.mutate();
  };

  if (isLoading) return <p>Loading...</p>;
  if (!contact) return <p>Contact not found</p>;

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={() => router.back()}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Back
      </Button>

      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{contact.name || contact.phone}</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push(`/contacts/${id}/edit`)}>
            <Pencil className="mr-2 h-4 w-4" /> Edit
          </Button>
          {!contact.optedOut && (
            <Button variant="outline" onClick={() => optOutMutation.mutate()}>
              <Ban className="mr-2 h-4 w-4" /> Opt Out
            </Button>
          )}
          <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>
            <Trash2 className="mr-2 h-4 w-4" /> Delete
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-lg">Contact Info</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Phone</span>
              <span className="font-mono">{contact.phone}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Email</span>
              <span>{contact.email || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <Badge variant={contact.optedOut ? 'destructive' : 'success'}>
                {contact.optedOut ? 'Opted Out' : 'Active'}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created</span>
              <span>{new Date(contact.createdAt).toLocaleDateString()}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Custom Fields</CardTitle></CardHeader>
          <CardContent>
            {Object.keys(contact.customFields).length === 0 ? (
              <p className="text-muted-foreground text-sm">No custom fields</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(contact.customFields).map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <span className="text-muted-foreground capitalize">{key}</span>
                    <span>{String(value)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
