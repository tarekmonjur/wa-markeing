'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';

interface Contact {
  id: string;
  phone: string;
  name?: string;
  email?: string;
  optedOut: boolean;
  customFields: Record<string, unknown>;
}

export default function EditContactPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = params.id as string;

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [business, setBusiness] = useState('');
  const [optedOut, setOptedOut] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const { data: contact, isLoading } = useQuery({
    queryKey: ['contact', id],
    queryFn: () => api.get<Contact>(`/contacts/${id}`),
  });

  useEffect(() => {
    if (contact && !loaded) {
      setName(contact.name ?? '');
      setEmail(contact.email ?? '');
      setCity((contact.customFields?.city as string) ?? '');
      setBusiness((contact.customFields?.business as string) ?? '');
      setOptedOut(contact.optedOut);
      setLoaded(true);
    }
  }, [contact, loaded]);

  const updateMutation = useMutation({
    mutationFn: () =>
      api.patch(`/contacts/${id}`, {
        name: name || undefined,
        email: email || undefined,
        customFields: { city: city || undefined, business: business || undefined },
        optedOut,
      }),
    onSuccess: () => {
      toast.success('Contact updated');
      queryClient.invalidateQueries({ queryKey: ['contact', id] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      router.push(`/contacts/${id}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading) return <p>Loading...</p>;
  if (!contact) return <p>Contact not found</p>;

  return (
    <div className="space-y-6 max-w-2xl">
      <Button variant="ghost" onClick={() => router.back()}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Back
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Edit Contact</CardTitle>
          <CardDescription>Update contact details for {contact.phone}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input value={contact.phone} disabled />
            <p className="text-xs text-muted-foreground">Phone number cannot be changed</p>
          </div>

          <div className="space-y-2">
            <Label>Name</Label>
            <Input placeholder="Contact name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" placeholder="email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>City</Label>
              <Input placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Business</Label>
              <Input placeholder="Business type" value={business} onChange={(e) => setBusiness(e.target.value)} />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="optedOut"
              checked={optedOut}
              onChange={(e) => setOptedOut(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="optedOut">Opted out (will not receive messages)</Label>
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              onClick={() => updateMutation.mutate()}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
            <Button variant="outline" onClick={() => router.push(`/contacts/${id}`)}>Cancel</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
