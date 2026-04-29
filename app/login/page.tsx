'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, LogIn, ShieldAlert, Sword } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { useAuth } from '@/context/AuthContext';

type LoginFormState = {
  email: string;
  password: string;
};

const emptyForm: LoginFormState = {
  email: '',
  password: '',
};

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, isAuthenticated, loading, configurationError } = useAuth();
  const [form, setForm] = React.useState<LoginFormState>(emptyForm);
  const [errorMessage, setErrorMessage] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const nextPath = searchParams.get('next') || '/';
  const authRequired = searchParams.get('reason') === 'auth-required';

  React.useEffect(() => {
    if (!loading && isAuthenticated) {
      router.replace(nextPath);
    }
  }, [isAuthenticated, loading, nextPath, router]);

  const updateForm = <Key extends keyof LoginFormState>(key: Key, value: LoginFormState[Key]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrorMessage('');
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage('');

    try {
      await login(form.email, form.password);
      router.replace(nextPath);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível entrar.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl">
      <div className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr] lg:items-stretch">
        <section className="rounded-lg border border-border-subtle bg-[radial-gradient(circle_at_24%_10%,rgba(250,204,21,0.18),transparent_34%),linear-gradient(135deg,#18181b_0%,#09090b_82%)] p-6 shadow-2xl">
          <Badge variant="primary" className="gap-2">
            <Sword size={13} />
            Albion Market Radar
          </Badge>
          <h1 className="mt-4 text-3xl font-black text-white md:text-5xl">Entrar</h1>
          <p className="mt-3 text-sm leading-relaxed text-zinc-400 md:text-base">
            Acesse suas ferramentas com o nome do seu personagem do Albion como identidade central.
          </p>

          <div className="mt-6 rounded-lg border border-status-warning/25 bg-status-warning/10 p-4 text-sm leading-relaxed text-status-warning">
            <div className="flex gap-3">
              <ShieldAlert className="mt-0.5 shrink-0" size={19} />
              <p>
                Nunca use a mesma senha da sua conta do Albion. Esta conta serve apenas para acessar suas ferramentas no Albion Market Radar.
              </p>
            </div>
          </div>

          <p className="mt-4 text-xs leading-relaxed text-zinc-500">
            Login com Supabase Auth. O Albion Market Radar não pede e nunca deve receber a senha da sua conta do Albion.
          </p>
        </section>

        <form onSubmit={handleSubmit} className="rounded-lg border border-border-subtle bg-bg-card p-6 shadow-2xl">
          <div>
            <h2 className="text-xl font-black text-white">Login</h2>
            <p className="mt-1 text-sm text-zinc-500">Use sua conta do Albion Market Radar.</p>
          </div>

          {authRequired ? (
            <div className="mt-5 rounded-lg border border-brand-primary/25 bg-brand-primary/10 p-4 text-sm font-bold text-brand-primary">
              Entre para usar as ferramentas do Albion Market Radar.
            </div>
          ) : null}

          {configurationError ? (
            <div className="mt-5 flex items-start gap-3 rounded-lg border border-status-warning/25 bg-status-warning/10 p-4 text-sm font-bold text-status-warning">
              <AlertTriangle className="mt-0.5 shrink-0" size={18} />
              {configurationError}
            </div>
          ) : null}

          {errorMessage ? (
            <div className="mt-5 flex items-start gap-3 rounded-lg border border-status-danger/25 bg-status-danger/10 p-4 text-sm font-bold text-status-danger">
              <AlertTriangle className="mt-0.5 shrink-0" size={18} />
              {errorMessage}
            </div>
          ) : null}

          <div className="mt-5 space-y-4">
            <label className="space-y-2">
              <span className="field-label">E-mail</span>
              <input
                type="email"
                value={form.email}
                onChange={(event) => updateForm('email', event.target.value)}
                required
                placeholder="teste@email.com"
                className="field-control"
              />
            </label>

            <label className="space-y-2">
              <span className="field-label">Senha</span>
              <input
                type="password"
                value={form.password}
                onChange={(event) => updateForm('password', event.target.value)}
                required
                className="field-control"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || Boolean(configurationError)}
            className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-brand-primary px-5 text-sm font-black text-bg-dark transition-colors hover:bg-brand-secondary disabled:cursor-not-allowed disabled:opacity-60"
          >
            <LogIn size={17} />
            {isSubmitting ? 'Entrando...' : 'Entrar'}
          </button>

          <p className="mt-5 text-center text-sm text-zinc-500">
            Ainda não tem conta?{' '}
            <Link href="/register" className="font-black text-brand-primary hover:text-brand-secondary">
              Criar conta
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="rounded-lg border border-border-subtle bg-bg-card p-6 text-sm text-zinc-400">Carregando login...</div>}>
      <LoginContent />
    </Suspense>
  );
}
