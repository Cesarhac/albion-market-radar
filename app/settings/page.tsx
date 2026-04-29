'use client';

import React from 'react';
import {
  CheckCircle2,
  Coins,
  Globe2,
  MapPin,
  Moon,
  Percent,
  RefreshCw,
  RotateCcw,
  Save,
  Settings,
  SlidersHorizontal,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { useUserSettings } from '@/context/UserSettingsContext';
import type { ServerParam } from '@/types/albion';
import type { UserSettings, UserSettingsFeedback } from '@/types/settings';
import { intervalLabel, mergeWithDefaultSettings } from '@/lib/settingsStorage';
import { cn, formatCityName, formatPercent } from '@/lib/utils';

const SERVER_OPTIONS: Array<{ value: ServerParam; label: string }> = [
  { value: 'americas', label: 'Américas' },
  { value: 'europe', label: 'Europa' },
];
const MAIN_CITY_OPTIONS: UserSettings['mainCity'][] = [
  'Bridgewatch',
  'Martlock',
  'Thetford',
  'Fort Sterling',
  'Lymhurst',
  'Caerleon',
  'Brecilien',
];
const UPDATE_INTERVAL_OPTIONS = [5, 10, 30, 60];

export default function SettingsPage() {
  const { settings, isLoaded, saveSettings, resetSettings } = useUserSettings();
  const [draft, setDraft] = React.useState<Partial<UserSettings>>({});
  const [feedback, setFeedback] = React.useState<UserSettingsFeedback>(null);
  const [errorMessage, setErrorMessage] = React.useState('');
  const currentSettings = mergeWithDefaultSettings({ ...settings, ...draft });

  const showFeedback = (nextFeedback: UserSettingsFeedback) => {
    setFeedback(nextFeedback);
    window.setTimeout(() => setFeedback(null), 2800);
  };

  const updateDraft = <Key extends keyof UserSettings>(key: Key, value: UserSettings[Key]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setFeedback(null);
    setErrorMessage('');
  };

  const handleSave = () => {
    const rawMarketTax = Number(draft.marketTax ?? settings.marketTax);

    if (!Number.isFinite(rawMarketTax) || rawMarketTax < 0 || rawMarketTax > 30) {
      setErrorMessage('A taxa de mercado precisa estar entre 0% e 30%.');
      setFeedback('error');
      return;
    }

    const normalizedSettings = mergeWithDefaultSettings({
      ...settings,
      ...draft,
      marketTax: rawMarketTax,
    });

    try {
      saveSettings(normalizedSettings);
      setDraft({});
      setErrorMessage('');
      showFeedback('saved');
    } catch {
      setErrorMessage('Erro ao salvar configurações. Verifique o navegador e tente novamente.');
      setFeedback('error');
    }
  };

  const handleReset = () => {
    try {
      resetSettings();
      setDraft({});
      setErrorMessage('');
      showFeedback('restored');
    } catch {
      setErrorMessage('Erro ao restaurar configurações.');
      setFeedback('error');
    }
  };

  return (
    <div className="space-y-8">
      <header className="rounded-lg border border-border-subtle bg-bg-card p-5 shadow-2xl md:p-6">
        <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="space-y-2">
            <Badge variant="primary" className="gap-2">
              <Settings size={13} />
              Preferências do radar
            </Badge>
            <h1 className="text-3xl font-black text-white">Configurações</h1>
            <p className="max-w-2xl text-sm leading-relaxed text-zinc-400">
              Ajuste suas preferências de mercado, servidor e cálculo de lucro.
            </p>
          </div>

          <div className="rounded-lg border border-brand-primary/20 bg-brand-primary/10 p-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-brand-primary/80">
              Taxa considerada
            </p>
            <p className="mt-1 text-2xl font-black text-brand-primary">
              {formatPercent(currentSettings.marketTax)}
            </p>
          </div>
        </div>
      </header>

      {!isLoaded ? (
        <div className="flex items-start gap-3 rounded-lg border border-border-subtle bg-bg-card p-4 text-zinc-400">
          <RefreshCw className="mt-0.5 shrink-0 animate-spin text-brand-primary" size={20} />
          <p className="text-sm font-bold">Carregando preferências locais do navegador...</p>
        </div>
      ) : null}

      {feedback === 'saved' ? (
        <FeedbackPanel message="Configurações salvas com sucesso." variant="success" />
      ) : null}

      {feedback === 'restored' ? (
        <FeedbackPanel message="Configurações restauradas." variant="warning" />
      ) : null}

      {errorMessage ? <FeedbackPanel message={errorMessage} variant="danger" /> : null}

      <section className="grid gap-6 lg:grid-cols-[0.35fr_0.65fr]">
        <aside className="rounded-lg border border-border-subtle bg-bg-card p-4 shadow-2xl">
          <div className="mb-4 flex items-center gap-2 px-2 text-sm font-black text-white">
            <SlidersHorizontal className="text-brand-primary" size={18} />
            Seções
          </div>
          {['Geral', 'Mercado', 'Preferências locais', 'Integração futura'].map((item, index) => (
            <button
              key={item}
              type="button"
              className={cn(
                'mb-1 block w-full rounded-lg px-3 py-3 text-left text-sm font-bold transition-colors',
                index === 0
                  ? 'border border-brand-primary/25 bg-brand-primary/10 text-brand-primary'
                  : 'text-zinc-500 hover:bg-zinc-950 hover:text-white',
              )}
            >
              {item}
            </button>
          ))}
        </aside>

        <div className="rounded-lg border border-border-subtle bg-bg-card shadow-2xl">
          <div className="border-b border-border-subtle p-5">
            <h2 className="text-xl font-black text-white">Preferências gerais</h2>
            <p className="mt-1 text-sm text-zinc-500">
              As preferências são salvas no Supabase para o player logado.
            </p>
          </div>

          <div className="divide-y divide-border-subtle/70">
            <SettingRow
              icon={Globe2}
              title="Servidor padrão"
              description="Usado como servidor inicial em busca, oportunidades e regear."
            >
              <select
                value={currentSettings.defaultServer}
                onChange={(event) => updateDraft('defaultServer', event.target.value as ServerParam)}
                className="h-11 w-full rounded-lg border border-border-subtle bg-zinc-950 px-3 text-sm font-bold text-white outline-none focus:border-brand-primary"
              >
                {SERVER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </SettingRow>

            <SettingRow
              icon={Percent}
              title="Taxa de mercado considerada"
              description="Base para calcular lucro líquido nas rotas e na busca."
            >
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  max={30}
                  step={0.1}
                  value={currentSettings.marketTax}
                  onChange={(event) => updateDraft('marketTax', Number(event.target.value))}
                  className="h-11 w-full rounded-lg border border-border-subtle bg-zinc-950 px-3 pr-10 text-sm font-bold text-white outline-none focus:border-brand-primary"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-zinc-500">%</span>
              </div>
            </SettingRow>

            <SettingRow
              icon={MapPin}
              title="Cidade principal"
              description="Preferência local para recursos futuros de rota e regear."
            >
              <select
                value={currentSettings.mainCity}
                onChange={(event) => updateDraft('mainCity', event.target.value as UserSettings['mainCity'])}
                className="h-11 w-full rounded-lg border border-border-subtle bg-zinc-950 px-3 text-sm font-bold text-white outline-none focus:border-brand-primary"
              >
                {MAIN_CITY_OPTIONS.map((city) => (
                  <option key={city} value={city}>
                    {formatCityName(city)}
                  </option>
                ))}
              </select>
            </SettingRow>

            <SettingRow
              icon={RefreshCw}
              title="Intervalo de atualização desejado"
              description="Preferência para futuras consultas automáticas e alertas."
            >
              <select
                value={currentSettings.updateInterval}
                onChange={(event) => updateDraft('updateInterval', Number(event.target.value))}
                className="h-11 w-full rounded-lg border border-border-subtle bg-zinc-950 px-3 text-sm font-bold text-white outline-none focus:border-brand-primary"
              >
                {UPDATE_INTERVAL_OPTIONS.map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {intervalLabel(minutes)}
                  </option>
                ))}
              </select>
            </SettingRow>

            <SettingRow
              icon={Moon}
              title="Tema escuro ativado"
              description="Pode ficar sempre ativo por enquanto, mas a preferência é persistida."
            >
              <button
                type="button"
                onClick={() => updateDraft('darkTheme', !currentSettings.darkTheme)}
                className={cn(
                  'flex h-11 w-20 items-center rounded-full border p-1 transition-colors',
                  currentSettings.darkTheme
                    ? 'justify-end border-brand-primary/25 bg-brand-primary/20'
                    : 'justify-start border-border-subtle bg-zinc-950',
                )}
                aria-pressed={currentSettings.darkTheme}
              >
                <span className="h-8 w-8 rounded-full bg-brand-primary shadow-lg" />
              </button>
            </SettingRow>

            <SettingRow
              icon={Coins}
              title="Moeda exibida"
              description="A interface usa prata como moeda padrão."
            >
              <div className="h-11 rounded-lg border border-border-subtle bg-zinc-950 px-3 py-3 text-sm font-black text-white opacity-80">
                Prata
              </div>
            </SettingRow>
          </div>

          <div className="flex flex-col gap-3 border-t border-border-subtle bg-zinc-950/50 p-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-bold uppercase tracking-wide text-zinc-600">
              Valores atuais: {SERVER_OPTIONS.find((item) => item.value === currentSettings.defaultServer)?.label},{' '}
              {formatPercent(currentSettings.marketTax)}, {formatCityName(currentSettings.mainCity)}.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-border-subtle bg-zinc-900 px-5 py-3 text-sm font-black text-white transition-colors hover:border-brand-primary/40"
              >
                <RotateCcw size={17} />
                Restaurar padrões
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-primary px-5 py-3 text-sm font-black text-bg-dark transition-colors hover:bg-brand-secondary"
              >
                <Save size={17} />
                Salvar configurações
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function FeedbackPanel({ message, variant }: { message: string; variant: 'success' | 'warning' | 'danger' }) {
  const variantClasses = {
    success: 'border-status-success/25 bg-status-success/10 text-status-success',
    warning: 'border-status-warning/25 bg-status-warning/10 text-status-warning',
    danger: 'border-status-danger/25 bg-status-danger/10 text-status-danger',
  };

  return (
    <div className={cn('flex items-start gap-3 rounded-lg border p-4', variantClasses[variant])}>
      <CheckCircle2 className="mt-0.5 shrink-0" size={20} />
      <p className="text-sm font-bold">{message}</p>
    </div>
  );
}

function SettingRow({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-4 p-5 md:grid-cols-[1fr_240px] md:items-center">
      <div>
        <h3 className="flex items-center gap-2 font-black text-white">
          <Icon className="text-brand-primary" size={18} />
          {title}
        </h3>
        <p className="mt-1 text-sm text-zinc-500">{description}</p>
      </div>
      {children}
    </div>
  );
}
