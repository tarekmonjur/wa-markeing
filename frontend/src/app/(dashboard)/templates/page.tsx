'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { toast } from 'sonner';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Plus, FileText } from 'lucide-react';

interface Template {
  id: string;
  name: string;
  body: string;
  mediaUrl?: string;
  createdAt: string;
}

export default function TemplatesPage() {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [body, setBody] = useState('');
  const queryClient = useQueryClient();

  const templates = useQuery({
    queryKey: ['templates'],
    queryFn: () => api.get<Template[]>('/templates'),
  });

  const createMutation = useMutation({
    mutationFn: () => api.post('/templates', { name, body }),
    onSuccess: () => {
      toast.success('Template created');
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      setShowForm(false);
      setName('');
      setBody('');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const rows = Array.isArray(templates.data) ? templates.data : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Templates</h1>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="mr-2 h-4 w-4" />
          New Template
        </Button>
      </div>

      {/* Create Form */}
      {showForm && (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="space-y-2">
              <Label>Template Name</Label>
              <Input placeholder="e.g. Eid Special Offer" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>
                Body <span className="text-xs text-muted-foreground">(supports {'{{name}}'}, {'{{phone}}'}, {'{{custom.field}}'})</span>
              </Label>
              <Textarea
                placeholder="Type your message template..."
                rows={5}
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">{body.length}/4096</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => createMutation.mutate()} disabled={!name || !body || createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create'}
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Template List */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((t) => (
          <Link key={t.id} href={`/templates/${t.id}`}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  {t.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-3">{t.body}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Created {new Date(t.createdAt).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
        {rows.length === 0 && !templates.isLoading && (
          <p className="col-span-full text-center text-muted-foreground py-8">
            No templates yet. Create your first template!
          </p>
        )}
      </div>
    </div>
  );
}
