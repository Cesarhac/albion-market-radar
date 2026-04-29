'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, CheckCircle2, Crown, LogOut, RefreshCw, Save, UserRound } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { useAuth } from '@/context/AuthContext';
import type { ServerParam, SubscriptionPlan, UserAccount } from '@/types/albion';
import { formatDateTime } from '@/lib/utils';

type ProfileFormState = {
  playerName: string;
  email: string;
  server: ServerParam;
};

export default function ProfilePage() {
  const router = useRouter();
  const {
    user,
    updateProfile,
    refreshAlbionPlayerData,
    logout,
    setDevelopmentPlan,
    configurationError,
  } = useAuth();
  const [form, setForm] = React.useState<ProfileFormState>({
    playerName: '',
    email: '',
    server: 'europe',
  });
  const [feedback, setFeedback] = React.useState('');
  const [errorMessage, setErrorMessage] = React.useState('');
  const [isSaving, setIsSaving] = React.useState(false);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [isChangingPlan, setIsChangingPlan] = React.useState(false);
  const isDevelopment = process.env.NODE_ENV === 'development';

  React.useEffect(() => {
    if (!user) return;

    queueMicrotask(() => {
      setForm({
        playerName: user.playerName,
        email: user.email,
        server: user.server,
      });
    });
  }, [user]);

  if (!user) {
    return (
      <div className="rounded-lg border border-border-subtle bg-bg-card p-6 text-sm font-bold text-zinc-400">
        Verificando login...
      </div>
    );
  }

  const updateForm = <Key extends keyof ProfileFormState>(key: Key, value: ProfileFormState[Key]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setFeedback('');
    setErrorMessage('');
  };

  const handleSave = async () => {
    if (!form.playerName.trim()) {
      setErrorMessage('Nome do player é obrigatório.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setErrorMessage('Informe um e-mail válido.');
      return;
    }

    setIsSaving(true);
    setFeedback('');
    setErrorMessage('');

    try {
      const result = await updateProfile(form);

      setFeedback(result.lookup.warning ?? 'Perfil atualizado.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível atualizar o perfil.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setFeedback('');
    setErrorMessage('');

    try {
      const lookup = await refreshAlbionPlayerData(form.playerName);
      const result = await updateProfile({
        ...form,
        playerName: lookup.playerName ?? form.playerName,
      });

      setFeedback(result.lookup.warning ?? 'Dados do Albion atualizados.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível atualizar os dados do Albion.');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  const handlePlanChange = async (plan: SubscriptionPlan) => {
    setIsChangingPlan(true);
    setFeedback('');
    setErrorMessage('');

    try {
      await setDevelopmentPlan(plan);
      setFeedback(plan === 'pro' ? 'Plano PRO ativado para teste.' : 'Plano FREE restaurado para teste.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível alterar o plano de teste.');
    } finally {
      setIsChangingPlan(false);
    }
  };

  return (
    <div className="space-y-8">
      <header className="rounded-lg border border-border-subtle bg-[radial-gradient(circle_at_20%_0%,rgba(250,204,21,0.16),transparent_34%),linear-gradient(135deg,#18181b_0%,#09090b_82%)] p-5 shadow-2xl md:p-6">
        <Badge variant="primary" className="gap-2">
          <UserRound size={13} />
          Perfil de jogador
        </Badge>
        <h1 className="mt-3 text-3xl font-black text-white md:text-5xl">{user.playerName}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400">
          Este nome será usado em carteira, anúncios de armas .4, favoritos, histórico, alertas e recursos sociais.
        </p>
      </header>

      {configurationError ? <FeedbackPanel message={configurationError} variant="warning" /> : null}
      {feedback ? <FeedbackPanel message={feedback} variant={feedback.includes('Não encontramos') ? 'warning' : 'success'} /> : null}
      {errorMessage ? <FeedbackPanel message={errorMessage} variant="danger" /> : null}

      <section className="grid gap-6 lg:grid-cols-[0.62fr_0.38fr]">
        <div className="rounded-lg border border-border-subtle bg-bg-card shadow-2xl">
          <div className="border-b border-border-subtle p-5">
            <h2 className="text-xl font-black text-white">Editar perfil</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Se mudar o nome do player, a busca pública do Albion será rodada novamente.
            </p>
          </div>

          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <label className="space-y-2 sm:col-span-2">
              <span className="field-label">Nome do player</span>
              <input
                value={form.playerName}
                onChange={(event) => updateForm('playerName', event.target.value)}
                className="field-control"
              />
            </label>

            <label className="space-y-2">
              <span className="field-label">E-mail</span>
              <input
                type="email"
                value={form.email}
                onChange={(event) => updateForm('email', event.target.value)}
                className="field-control"
              />
            </label>

            <label className="space-y-2">
              <span className="field-label">Servidor principal</span>
              <select
                value={form.server}
                onChange={(event) => updateForm('server', event.target.value as ServerParam)}
                className="field-control"
              >
                <option value="americas">Américas</option>
                <option value="europe">Europa</option>
              </select>
            </label>
          </div>

          <div className="flex flex-col gap-3 border-t border-border-subtle bg-zinc-950/50 p-5 sm:flex-row sm:justify-end">
            <button type="button" onClick={handleRefresh} disabled={isRefreshing} className="secondary-button justify-center">
              <RefreshCw className={isRefreshing ? 'animate-spin' : ''} size={17} />
              Atualizar dados do Albion
            </button>
            <button type="button" onClick={handleSave} disabled={isSaving} className="primary-button justify-center">
              <Save size={17} />
              Salvar perfil
            </button>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-lg border border-border-subtle bg-bg-card p-5 shadow-2xl">
            <h2 className="font-black text-white">Dados da conta</h2>
            <div className="mt-4 space-y-3 text-sm">
              <ProfileLine label="Nome" value={user.playerName} />
              <ProfileLine label="E-mail" value={user.email} />
              <ProfileLine label="Servidor" value={user.server === 'europe' ? 'Europa' : 'Américas'} />
              <ProfileLine label="Plano" value={user.plan === 'pro' ? 'PRO' : 'FREE'} />
              <ProfileLine label="Status do plano" value={planStatusLabel(user.subscriptionStatus)} />
              <ProfileLine label="Player ID" value={user.playerId ?? 'Não validado'} />
              <ProfileLine label="Guilda" value={user.guildName ?? 'Não informado'} />
              <ProfileLine label="Aliança" value={user.allianceName ?? 'Não informado'} />
              <ProfileLine label="Criada em" value={formatDateTime(user.createdAt)} />
            </div>
          </div>

          {isDevelopment ? (
            <div className="rounded-lg border border-brand-primary/20 bg-brand-primary/10 p-5">
              <h2 className="flex items-center gap-2 font-black text-brand-primary">
                <Crown size={18} />
                Teste de plano
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-zinc-300">
                Visível apenas em desenvolvimento para validar limites Free/Pro sem checkout real.
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => handlePlanChange('pro')}
                  disabled={isChangingPlan}
                  className="primary-button justify-center"
                >
                  Ativar PRO
                </button>
                <button
                  type="button"
                  onClick={() => handlePlanChange('free')}
                  disabled={isChangingPlan}
                  className="secondary-button justify-center"
                >
                  Voltar FREE
                </button>
              </div>
            </div>
          ) : null}

          <div className="rounded-lg border border-border-subtle bg-bg-card p-5 text-sm leading-relaxed text-zinc-400">
            Você poderá importar dados locais deste navegador em uma etapa futura. O localStorage antigo não foi apagado.
          </div>

          <button type="button" onClick={handleLogout} className="danger-button w-full justify-center">
            <LogOut size={17} />
            Sair
          </button>
        </aside>
      </section>
    </div>
  );
}

function ProfileLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border-subtle bg-zinc-950 p-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 break-all font-black text-white">{value}</p>
    </div>
  );
}

function FeedbackPanel({ message, variant }: { message: string; variant: 'success' | 'warning' | 'danger' }) {
  const styles = {
    success: 'border-status-success/25 bg-status-success/10 text-status-success',
    warning: 'border-status-warning/25 bg-status-warning/10 text-status-warning',
    danger: 'border-status-danger/25 bg-status-danger/10 text-status-danger',
  };
  const Icon = variant === 'success' ? CheckCircle2 : AlertTriangle;

  return (
    <div className={`flex items-start gap-3 rounded-lg border p-4 text-sm font-bold ${styles[variant]}`}>
      <Icon className="mt-0.5 shrink-0" size={18} />
      {message}
    </div>
  );
}

function planStatusLabel(status: UserAccount['subscriptionStatus']): string {
  const labels: Record<UserAccount['subscriptionStatus'], string> = {
    free: 'Free',
    active: 'Ativo',
    past_due: 'Pagamento pendente',
    canceled: 'Cancelado',
  };

  return labels[status];
}
