'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';

interface Template {
  id: string;
  name: string;
  body: string;
  mediaUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export default function TemplateDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = params.id as string;
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [body, setBody] = useState('');

  const { data: template, isLoading } = useQuery({
    queryKey: ['template', id],
    queryFn: () => api.get<Template>(`/templates/${id}`),
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: () => api.patch(`/templates/${id}`, { name, body }),
    onSuccess: () => {
      toast.success('Template updated');
      queryClient.invalidateQueries({ queryKey: ['template', id] });
      setEditing(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/templates/${id}`),
    onSuccess: () => {
      toast.success('Template deleted');
      router.push('/templates');
    },
  });

  const startEdit = () => {
    if (template) {
      setName(template.name);
      setBody(template.body);
      setEditing(true);
    }
  };

  if (isLoading) return <p>Loading...</p>;
  if (!template) return <p>Template not found</p>;

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={() => router.back()}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Back
      </Button>

      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{template.name}</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={startEdit}>
            <Pencil className="mr-2 h-4 w-4" /> Edit
          </Button>
          <Button variant="destructive" onClick={() => deleteMutation.mutate()}>
            <Trash2 className="mr-2 h-4 w-4" /> Delete
          </Button>
        </div>
      </div>

      {editing ? (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Body</Label>
              <Textarea rows={6} value={body} onChange={(e) => setBody(e.target.value)} />
              <p className="text-xs text-muted-foreground">{body.length}/4096</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>Save</Button>
              <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Message Body</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="whitespace-pre-wrap rounded-md bg-gray-50 p-4 text-sm">{template.body}</div>
            <p className="mt-4 text-xs text-muted-foreground">
              Last updated: {new Date(template.updatedAt).toLocaleString()}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
