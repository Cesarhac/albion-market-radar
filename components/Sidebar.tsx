'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Crown,
  Bell,
  LayoutDashboard,
  Menu,
  MessageCircle,
  PackageSearch,
  Radar,
  Search,
  Settings,
  Sword,
  Wallet,
  X,
  Zap,
} from 'lucide-react';
import { useAlerts } from '@/context/AlertsContext';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { isActiveProProfile } from '@/src/lib/entitlements';

const navItems = [
  { name: 'Painel', href: '/', icon: LayoutDashboard },
  { name: 'Buscar preços', href: '/search', icon: Search },
  { name: 'Oportunidades', href: '/opportunities', icon: Zap },
  { name: 'Radar de Regear', href: '/regear', icon: PackageSearch },
  { name: 'Carteira', href: '/trader', icon: Wallet },
  { name: 'Armas .4', href: '/weapons', icon: Sword },
  { name: 'Chat', href: '/chat', icon: MessageCircle },
  { name: 'Alertas', href: '/alerts', icon: Bell },
  { name: 'PRO', href: '/pro', icon: Crown },
  { name: 'Configurações', href: '/settings', icon: Settings },
];

const publicNavItems = [
  { name: 'Painel', href: '/', icon: LayoutDashboard },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuth();
  const { triggeredAlertCount } = useAlerts();
  const [isOpen, setIsOpen] = React.useState(false);
  const visibleNavItems = isAuthenticated ? navItems : publicNavItems;
  const isProActive = isActiveProProfile(user);

  const handleLogout = () => {
    logout();
    setIsOpen(false);
    router.push('/');
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        className="fixed left-4 top-4 z-50 inline-flex h-11 w-11 items-center justify-center rounded-lg border border-border-subtle bg-bg-card text-brand-primary shadow-xl lg:hidden"
        aria-label={isOpen ? 'Fechar menu' : 'Abrir menu'}
      >
        {isOpen ? <X size={22} /> : <Menu size={22} />}
      </button>

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-72 max-w-[86vw] flex-col border-r border-border-subtle bg-bg-card shadow-2xl transition-transform duration-200 lg:w-64 lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="border-b border-border-subtle p-5">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-primary text-bg-dark shadow-[0_0_24px_rgba(250,204,21,0.24)]">
              <Radar size={24} />
            </span>
            <span>
              <span className="block text-lg font-black leading-tight text-white">Albion Market</span>
              <span className="block text-[11px] font-bold uppercase tracking-[0.22em] text-brand-primary">
                Radar
              </span>
            </span>
          </Link>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-4">
          {visibleNavItems.map((item) => {
            const isActive = pathname === item.href;
            const isProItem = item.href === '/pro';
            const isAlertsItem = item.href === '/alerts';

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'group flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-bold transition-colors',
                  isActive
                    ? 'border border-brand-primary/25 bg-brand-primary/10 text-brand-primary'
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-white',
                  isProItem && !isActive && 'border border-brand-primary/20 bg-brand-primary/5 text-brand-primary hover:bg-brand-primary/10',
                )}
              >
                <item.icon
                  size={19}
                  className={cn(isActive ? 'text-brand-primary' : 'text-zinc-500 group-hover:text-white')}
                />
                <span className="min-w-0 flex-1">{item.name}</span>
                {isProItem ? (
                  <span className="rounded-md border border-brand-primary/30 bg-brand-primary/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-brand-primary">
                    {isProActive ? 'PRO ativo' : 'PRO'}
                  </span>
                ) : null}
                {isAlertsItem && triggeredAlertCount > 0 ? (
                  <span className="rounded-md border border-status-warning/30 bg-status-warning/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-status-warning">
                    {triggeredAlertCount}
                  </span>
                ) : null}
              </Link>
            );
          })}

          <div className="mt-4 border-t border-border-subtle pt-4">
            {!isAuthenticated ? (
              <div className="grid gap-2">
                <Link
                  href="/login"
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    'rounded-lg px-3 py-3 text-sm font-bold transition-colors',
                    pathname === '/login'
                      ? 'border border-brand-primary/25 bg-brand-primary/10 text-brand-primary'
                      : 'text-zinc-400 hover:bg-zinc-900 hover:text-white',
                  )}
                >
                  Entrar
                </Link>
                <Link
                  href="/register"
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg bg-brand-primary px-3 py-3 text-sm font-black text-bg-dark transition-colors hover:bg-brand-secondary"
                >
                  Criar conta
                </Link>
              </div>
            ) : (
              <div className="space-y-3 rounded-lg border border-border-subtle bg-zinc-950/70 p-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Logado como</p>
                  <p className="mt-1 truncate font-black text-brand-primary">{user?.playerName}</p>
                </div>
                <div className="grid gap-2">
                  <Link
                    href="/profile"
                    onClick={() => setIsOpen(false)}
                    className="rounded-lg border border-border-subtle bg-zinc-900 px-3 py-2 text-sm font-bold text-white transition-colors hover:border-brand-primary/40"
                  >
                    Perfil
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="rounded-lg border border-status-danger/25 bg-status-danger/10 px-3 py-2 text-left text-sm font-bold text-status-danger transition-colors hover:bg-status-danger/20"
                  >
                    Sair
                  </button>
                </div>
              </div>
            )}
          </div>
        </nav>

        <div className="border-t border-border-subtle p-4">
          <div className="rounded-lg border border-border-subtle bg-zinc-950/70 p-3">
            <div className="mb-3 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-status-success" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                Dados públicos
              </span>
            </div>
            <p className="text-xs leading-relaxed text-zinc-500">
              Preços do Albion Online Data Project com fallback demonstrativo quando a API falhar.
            </p>
          </div>
        </div>
      </aside>

      {isOpen ? (
        <button
          type="button"
          aria-label="Fechar menu"
          className="fixed inset-0 z-30 bg-black/70 backdrop-blur-sm lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      ) : null}
    </>
  );
}
