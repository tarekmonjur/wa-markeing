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

interface Campaign {
  id: string;
  name: string;
  status: string;
  sessionId: string;
  templateId?: string;
  groupId?: string;
}

interface Session { id: string; phoneNumber?: string; displayName?: string; status: string; }
interface Group { id: string; name: string; }
interface Template { id: string; name: string; body: string; }

export default function EditCampaignPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = params.id as string;

  const [name, setName] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [groupId, setGroupId] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [loaded, setLoaded] = useState(false);

  const { data: campaign, isLoading } = useQuery({
    queryKey: ['campaign', id],
    queryFn: () => api.get<Campaign>(`/campaigns/${id}`),
  });

  const sessions = useQuery({
    queryKey: ['sessions'],
    queryFn: () => api.get<Session[]>('/whatsapp/sessions'),
  });

  const groups = useQuery({
    queryKey: ['groups'],
    queryFn: () => api.get<Group[]>('/contacts/groups'),
  });

  const templates = useQuery({
    queryKey: ['templates'],
    queryFn: () => api.get<Template[]>('/templates'),
  });

  // Populate form with existing data once loaded
  useEffect(() => {
    if (campaign && !loaded) {
      setName(campaign.name);
      setSessionId(campaign.sessionId);
      setGroupId(campaign.groupId ?? '');
      setTemplateId(campaign.templateId ?? '');
      setLoaded(true);
    }
  }, [campaign, loaded]);

  const updateMutation = useMutation({
    mutationFn: () =>
      api.patch(`/campaigns/${id}`, {
        name,
        groupId: groupId || undefined,
        templateId: templateId || undefined,
      }),
    onSuccess: () => {
      toast.success('Campaign updated');
      queryClient.invalidateQueries({ queryKey: ['campaign', id] });
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      router.push(`/campaigns/${id}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading) return <p>Loading...</p>;
  if (!campaign) return <p>Campaign not found</p>;

  if (campaign.status !== 'DRAFT') {
    return (
      <div className="space-y-6 max-w-2xl">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">Only DRAFT campaigns can be edited. This campaign is <strong>{campaign.status}</strong>.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const sessionList = Array.isArray(sessions.data) ? sessions.data : [];
  const groupList = Array.isArray(groups.data) ? groups.data : [];
  const templateList = Array.isArray(templates.data) ? templates.data : [];

  return (
    <div className="space-y-6 max-w-2xl">
      <Button variant="ghost" onClick={() => router.back()}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Back
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Edit Campaign</CardTitle>
          <CardDescription>Modify your draft campaign before launching</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Campaign Name *</Label>
            <Input placeholder="e.g. Eid Offer 2025" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>WhatsApp Session</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={sessionId}
              disabled
            >
              <option value="">Select a session...</option>
              {sessionList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.displayName || s.phoneNumber || s.id.slice(0, 8)} — {s.status}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">Session cannot be changed after creation</p>
          </div>

          <div className="space-y-2">
            <Label>Contact Group</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
            >
              <option value="">Select a group...</option>
              {groupList.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>Message Template</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
            >
              <option value="">Select a template...</option>
              {templateList.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>

            {templateId && (
              <div className="mt-2 rounded-md bg-gray-50 p-3 text-sm whitespace-pre-wrap">
                {templateList.find((t) => t.id === templateId)?.body}
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              onClick={() => updateMutation.mutate()}
              disabled={!name || updateMutation.isPending}
            >
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
            <Button variant="outline" onClick={() => router.push(`/campaigns/${id}`)}>Cancel</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
