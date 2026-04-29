'use client';

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const PUBLIC_PATHS = new Set([
  '/',
  '/login',
  '/register',
  '/privacy',
  '/terms',
  '/anti-rmt',
  '/transparency',
  '/changelog',
]);

const PROTECTED_PREFIXES = [
  '/search',
  '/opportunities',
  '/trader',
  '/weapons',
  '/regear',
  '/favorites',
  '/settings',
  '/chat',
  '/profile',
  '/competition',
  '/pro',
];

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, loading } = useAuth();
  const isPublicPath = PUBLIC_PATHS.has(pathname);
  const needsAuth = !isPublicPath && PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  React.useEffect(() => {
    if (loading || !needsAuth || isAuthenticated) return;

    router.replace(`/login?reason=auth-required&next=${encodeURIComponent(pathname)}`);
  }, [isAuthenticated, loading, needsAuth, pathname, router]);

  if (loading && needsAuth) {
    return <AuthLoading message="Verificando login..." />;
  }

  if (needsAuth && !isAuthenticated) {
    return <AuthLoading message="Entre para usar as ferramentas do Albion Market Radar." />;
  }

  return children;
}

function AuthLoading({ message }: { message: string }) {
  return (
    <div className="flex min-h-80 items-center justify-center rounded-lg border border-border-subtle bg-bg-card">
      <div className="text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg border border-brand-primary/25 bg-brand-primary/10 text-brand-primary">
          <ShieldCheck size={26} />
        </div>
        <p className="mt-4 text-sm font-bold text-zinc-400">{message}</p>
      </div>
    </div>
  );
}
