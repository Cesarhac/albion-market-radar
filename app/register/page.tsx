'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, CheckCircle2, ShieldAlert, UserPlus } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { useAuth } from '@/context/AuthContext';
import type { ServerParam } from '@/types/albion';

type RegisterFormState = {
  playerName: string;
  email: string;
  password: string;
  confirmPassword: string;
  server: ServerParam;
  confirmedPlayerName: boolean;
};

const emptyForm: RegisterFormState = {
  playerName: '',
  email: '',
  password: '',
  confirmPassword: '',
  server: 'europe',
  confirmedPlayerName: false,
};

export default function RegisterPage() {
  const router = useRouter();
  const { registerUser, configurationError } = useAuth();
  const [form, setForm] = React.useState<RegisterFormState>(emptyForm);
  const [errorMessage, setErrorMessage] = React.useState('');
  const [successMessage, setSuccessMessage] = React.useState('');
  const [lookupWarning, setLookupWarning] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const updateForm = <Key extends keyof RegisterFormState>(key: Key, value: RegisterFormState[Key]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrorMessage('');
    setLookupWarning('');
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const validationError = validateRegisterForm(form);

    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');
    setSuccessMessage('');
    setLookupWarning('');

    try {
      const result = await registerUser({
        playerName: form.playerName,
        email: form.email,
        password: form.password,
        server: form.server,
      });

      setLookupWarning(result.lookup.warning ?? '');
      setSuccessMessage('Conta criada no Supabase. Entre com e-mail e senha para continuar.');
      window.setTimeout(() => router.push('/login'), 900);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível criar a conta agora.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl">
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-lg border border-border-subtle bg-[radial-gradient(circle_at_24%_10%,rgba(250,204,21,0.18),transparent_34%),linear-gradient(135deg,#18181b_0%,#09090b_82%)] p-6 shadow-2xl">
          <Badge variant="primary" className="gap-2">
            <UserPlus size={13} />
            Identidade do jogador
          </Badge>
          <h1 className="mt-4 text-3xl font-black text-white md:text-5xl">Criar conta</h1>
          <p className="mt-3 text-sm leading-relaxed text-zinc-400 md:text-base">
            Use o mesmo nome do seu personagem no Albion Online.
          </p>

          <div className="mt-6 rounded-lg border border-status-warning/25 bg-status-warning/10 p-4 text-sm leading-relaxed text-status-warning">
            <div className="flex gap-3">
              <ShieldAlert className="mt-0.5 shrink-0" size={19} />
              <p>
                Nunca use a mesma senha da sua conta do Albion. O site não é afiliado à Sandbox Interactive e não vende prata, itens por dinheiro real ou contas.
              </p>
            </div>
          </div>

          <p className="mt-4 text-xs leading-relaxed text-zinc-500">
            Cadastro com Supabase Auth. Dados como carteira, favoritos, configurações, chat e anúncios passam a ficar associados ao seu player.
          </p>
        </section>

        <form onSubmit={handleSubmit} className="rounded-lg border border-border-subtle bg-bg-card p-6 shadow-2xl">
          {configurationError ? <FeedbackPanel message={configurationError} variant="warning" /> : null}
          {errorMessage ? <FeedbackPanel message={errorMessage} variant="danger" /> : null}
          {lookupWarning ? <FeedbackPanel message={lookupWarning} variant="warning" /> : null}
          {successMessage ? <FeedbackPanel message={successMessage} variant="success" /> : null}

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 sm:col-span-2">
              <span className="field-label">Nome do player no Albion</span>
              <input
                value={form.playerName}
                onChange={(event) => updateForm('playerName', event.target.value)}
                required
                placeholder="Cesar018"
                className="field-control"
              />
            </label>

            <label className="space-y-2 sm:col-span-2">
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
                minLength={6}
                className="field-control"
              />
            </label>

            <label className="space-y-2">
              <span className="field-label">Confirmar senha</span>
              <input
                type="password"
                value={form.confirmPassword}
                onChange={(event) => updateForm('confirmPassword', event.target.value)}
                required
                minLength={6}
                className="field-control"
              />
            </label>

            <label className="space-y-2 sm:col-span-2">
              <span className="field-label">Servidor principal</span>
              <select
                value={form.server}
                onChange={(event) => updateForm('server', event.target.value as ServerParam)}
                required
                className="field-control"
              >
                <option value="americas">Américas</option>
                <option value="europe">Europa</option>
              </select>
            </label>

            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border-subtle bg-zinc-950 p-4 sm:col-span-2">
              <input
                type="checkbox"
                checked={form.confirmedPlayerName}
                onChange={(event) => updateForm('confirmedPlayerName', event.target.checked)}
                required
                className="mt-1 h-4 w-4 accent-brand-primary"
              />
              <span className="text-sm font-bold text-zinc-300">
                Confirmo que este é meu nome de personagem no Albion Online.
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || Boolean(configurationError)}
            className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-brand-primary px-5 text-sm font-black text-bg-dark transition-colors hover:bg-brand-secondary disabled:cursor-not-allowed disabled:opacity-60"
          >
            <UserPlus size={17} />
            {isSubmitting ? 'Criando conta...' : 'Criar conta'}
          </button>
        </form>
      </div>
    </div>
  );
}

function validateRegisterForm(form: RegisterFormState): string {
  if (!form.playerName.trim()) return 'Nome do player é obrigatório.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return 'Informe um e-mail válido.';
  if (form.password.length < 6) return 'A senha precisa ter pelo menos 6 caracteres.';
  if (form.password !== form.confirmPassword) return 'A confirmação de senha precisa ser igual.';
  if (!form.server) return 'Escolha um servidor principal.';
  if (!form.confirmedPlayerName) return 'Confirme que este é seu nome de personagem no Albion Online.';

  return '';
}

function FeedbackPanel({ message, variant }: { message: string; variant: 'success' | 'warning' | 'danger' }) {
  const styles = {
    success: 'border-status-success/25 bg-status-success/10 text-status-success',
    warning: 'border-status-warning/25 bg-status-warning/10 text-status-warning',
    danger: 'border-status-danger/25 bg-status-danger/10 text-status-danger',
  };
  const Icon = variant === 'success' ? CheckCircle2 : AlertTriangle;

  return (
    <div className={`mb-4 flex items-start gap-3 rounded-lg border p-4 text-sm font-bold ${styles[variant]}`}>
      <Icon className="mt-0.5 shrink-0" size={18} />
      {message}
    </div>
  );
}
