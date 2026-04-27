'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import { toast } from 'sonner';

interface NotificationPreferences {
  campaignCompleted: boolean;
  sessionDisconnected: boolean;
  tosBlockAlert: boolean;
  webhookAbandoned: boolean;
  dailySummary: boolean;
}

const PREF_LABELS: Record<keyof NotificationPreferences, { label: string; description: string }> = {
  campaignCompleted: {
    label: 'Campaign Completed',
    description: 'Get notified when a campaign finishes sending',
  },
  sessionDisconnected: {
    label: 'Session Disconnected',
    description: 'Alert when a WhatsApp session is disconnected',
  },
  tosBlockAlert: {
    label: 'TOS Block Alert',
    description: 'Critical alert when a session is blocked by WhatsApp',
  },
  webhookAbandoned: {
    label: 'Webhook Delivery Failed',
    description: 'Notify when webhook delivery is permanently abandoned',
  },
  dailySummary: {
    label: 'Daily Summary',
    description: 'Receive a daily summary of messages, campaigns, and contacts',
  },
};

export default function NotificationPreferencesPage() {
  const { token } = useAuthStore();
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/v1/notifications/preferences', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => setPrefs(d.data ?? d))
      .catch(() => toast.error('Failed to load preferences'));
  }, [token]);

  const toggle = async (key: keyof NotificationPreferences) => {
    if (!prefs) return;
    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated);
    setSaving(true);

    try {
      await fetch('/api/v1/notifications/preferences', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ [key]: updated[key] }),
      });
      toast.success('Preference updated');
    } catch {
      setPrefs(prefs); // revert
      toast.error('Failed to update');
    } finally {
      setSaving(false);
    }
  };

  if (!prefs) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Notification Preferences</h1>
      <p className="text-gray-500 mb-6">
        Choose which email notifications you want to receive.
      </p>

      <div className="space-y-4">
        {(Object.keys(PREF_LABELS) as (keyof NotificationPreferences)[]).map(
          (key) => (
            <div
              key={key}
              className="flex items-center justify-between p-4 border rounded-lg"
            >
              <div>
                <p className="font-medium">{PREF_LABELS[key].label}</p>
                <p className="text-sm text-gray-500">
                  {PREF_LABELS[key].description}
                </p>
              </div>
              <button
                onClick={() => toggle(key)}
                disabled={saving}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                  prefs[key] ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform ${
                    prefs[key] ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          ),
        )}
      </div>
    </div>
  );
}
