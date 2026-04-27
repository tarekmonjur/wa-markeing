'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/auth-store';
import { connectSocket, disconnectSocket } from '@/lib/socket';
import {
  LayoutDashboard,
  Users,
  FileText,
  Send,
  MessageSquare,
  FolderOpen,
  LogOut,
  Inbox,
  Bot,
  GitBranch,
  BarChart3,
  Sparkles,
  Webhook,
  UsersRound,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/contacts', label: 'Contacts', icon: Users },
  { href: '/contacts/groups', label: 'Groups', icon: FolderOpen },
  { href: '/templates', label: 'Templates', icon: FileText },
  { href: '/campaigns', label: 'Campaigns', icon: Send },
  { href: '/inbox', label: 'Inbox', icon: Inbox },
  { href: '/automations/auto-replies', label: 'Auto-Replies', icon: Bot },
  { href: '/automations/drip-sequences', label: 'Drip Sequences', icon: GitBranch },
  { href: '/settings/whatsapp', label: 'WhatsApp', icon: MessageSquare },
  { href: '/whatsapp/accounts', label: 'Accounts', icon: MessageSquare },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/ai', label: 'AI Generator', icon: Sparkles },
  { href: '/integrations/webhooks', label: 'Webhooks', icon: Webhook },
  { href: '/settings/team', label: 'Team', icon: UsersRound },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, user, logout, hydrate } = useAuthStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (isAuthenticated) {
      connectSocket();
      return () => disconnectSocket();
    }
  }, [isAuthenticated]);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="hidden w-64 flex-col border-r bg-white md:flex">
        <div className="flex h-16 items-center border-b px-6">
          <h1 className="text-xl font-bold text-brand-600">WA Marketing</h1>
        </div>
        <nav className="flex-1 space-y-1 p-4">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t p-4">
          <div className="mb-2 text-sm text-muted-foreground truncate">
            {user?.email}
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
