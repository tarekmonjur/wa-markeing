'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import { toast } from 'sonner';

interface UserRow {
  id: string;
  name: string;
  email: string;
  plan: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

export default function AdminUsersPage() {
  const { token } = useAuthStore();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/v1/teams/members', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => setUsers(d.data ?? []))
      .catch(() => toast.error('Failed to load users'))
      .finally(() => setLoading(false));
  }, [token]);

  const updatePlan = async (userId: string, plan: string) => {
    try {
      await fetch(`/api/v1/teams/members/${userId}/plan`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ plan }),
      });
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, plan } : u)),
      );
      toast.success('Plan updated');
    } catch {
      toast.error('Failed to update plan');
    }
  };

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">User Management</h1>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b text-left">
              <th className="p-3">Name</th>
              <th className="p-3">Email</th>
              <th className="p-3">Role</th>
              <th className="p-3">Plan</th>
              <th className="p-3">Status</th>
              <th className="p-3">Joined</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b hover:bg-gray-50">
                <td className="p-3 font-medium">{u.name}</td>
                <td className="p-3 text-gray-500">{u.email}</td>
                <td className="p-3">
                  <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700">
                    {u.role}
                  </span>
                </td>
                <td className="p-3">
                  <select
                    value={u.plan}
                    onChange={(e) => updatePlan(u.id, e.target.value)}
                    className="border rounded px-2 py-1 text-sm"
                  >
                    <option value="FREE">FREE</option>
                    <option value="STARTER">STARTER</option>
                    <option value="PRO">PRO</option>
                    <option value="AGENCY">AGENCY</option>
                  </select>
                </td>
                <td className="p-3">
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${
                      u.isActive
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {u.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="p-3 text-gray-500">
                  {new Date(u.createdAt).toLocaleDateString()}
                </td>
                <td className="p-3">
                  <button className="text-sm text-blue-600 hover:underline">
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {users.length === 0 && (
        <p className="text-center text-gray-500 mt-8">No users found</p>
      )}
    </div>
  );
}
