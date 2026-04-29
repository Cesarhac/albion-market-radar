'use client';

import React from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Bell,
  BellOff,
  Clock3,
  Eye,
  Star,
  Target,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import { ProGate } from '@/components/ProGate';
import { Badge } from '@/components/ui/Badge';
import { useAuth } from '@/context/AuthContext';
import { cn, formatCityName, formatRelativeTime, formatSilver } from '@/lib/utils';
import { formatEntitlementLimit, getUserEntitlements } from '@/src/lib/entitlements';
import {
  deleteFavoriteFromSupabase,
  fetchFavoritesFromSupabase,
  updateFavoriteAlert,
} from '@/src/lib/supabase/database';
import type { FavoriteItem } from '@/types/albion';

export default function FavoritesPage() {
  const { user } = useAuth();
  const entitlements = React.useMemo(() => getUserEntitlements(user), [user]);
  const [favorites, setFavorites] = React.useState<FavoriteItem[]>([]);
  const [isLoaded, setIsLoaded] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState('');
  const hasReachedFavoriteLimit =
    Number.isFinite(entitlements.maxFavorites) && favorites.length >= entitlements.maxFavorites;

  React.useEffect(() => {
    let isActive = true;

    async function loadFavorites() {
      setIsLoaded(false);
      setErrorMessage('');

      try {
        const nextFavorites = await fetchFavoritesFromSupabase();

        if (!isActive) return;
        setFavorites(nextFavorites);
      } catch (error) {
        if (!isActive) return;
        setErrorMessage(error instanceof Error ? error.message : 'Não foi possível carregar favoritos.');
      }

      if (isActive) setIsLoaded(true);
    }

    if (user) void loadFavorites();

    return () => {
      isActive = false;
    };
  }, [user]);

  const toggleAlert = async (favorite: FavoriteItem) => {
    const nextAlertStatus = !favorite.alertStatus;

    setFavorites((current) =>
      current.map((currentFavorite) =>
        currentFavorite.id === favorite.id ? { ...currentFavorite, alertStatus: nextAlertStatus } : currentFavorite,
      ),
    );

    try {
      await updateFavoriteAlert(favorite.id, nextAlertStatus);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível atualizar o alerta.');
      setFavorites((current) =>
        current.map((currentFavorite) =>
          currentFavorite.id === favorite.id ? { ...currentFavorite, alertStatus: favorite.alertStatus } : currentFavorite,
        ),
      );
    }
  };

  const removeFavorite = async (id: string) => {
    const previousFavorites = favorites;

    setFavorites((current) => current.filter((favorite) => favorite.id !== id));

    try {
      await deleteFavoriteFromSupabase(id);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível remover o favorito.');
      setFavorites(previousFavorites);
    }
  };

  const activeAlerts = favorites.filter((favorite) => favorite.alertStatus).length;
  const expectedProfit = favorites.reduce((total, favorite) => total + favorite.expectedProfit, 0);

  return (
    <div className="space-y-8">
      <header className="rounded-lg border border-border-subtle bg-bg-card p-5 shadow-2xl md:p-6">
        <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="space-y-2">
            <Badge variant="primary" className="gap-2">
              <Star size={13} />
              Lista de monitoramento
            </Badge>
            <h1 className="text-3xl font-black text-white">Favoritos</h1>
            <p className="max-w-2xl text-sm leading-relaxed text-zinc-400">
              Acompanhe itens de interesse, preço alvo, rota sugerida, status do alerta e lucro esperado.
              Dados salvos no Supabase para{' '}
              <span className="font-bold text-brand-primary">{user?.playerName ?? 'seu player'}</span>.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border-subtle bg-zinc-950 p-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">Alertas ativos</p>
              <p className="mt-1 text-2xl font-black text-brand-primary">{activeAlerts}</p>
            </div>
            <div className="rounded-lg border border-status-success/20 bg-status-success/10 p-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-status-success/80">
                Lucro esperado
              </p>
              <p className="mt-1 text-2xl font-black text-status-success">
                {formatSilver(expectedProfit)}
              </p>
            </div>
          </div>
        </div>
      </header>

      {errorMessage ? (
        <section className="rounded-lg border border-status-warning/25 bg-status-warning/10 p-4 text-sm font-bold text-status-warning">
          {errorMessage}
        </section>
      ) : null}

      {hasReachedFavoriteLimit ? (
        <ProGate
          title="Limite de favoritos Free"
          description={`Você atingiu ${formatEntitlementLimit(entitlements.maxFavorites)} favoritos. O plano PRO terá favoritos ilimitados.`}
        />
      ) : null}

      {!isLoaded ? (
        <section className="rounded-lg border border-border-subtle bg-bg-card p-6 text-sm font-bold text-zinc-400">
          Carregando favoritos no Supabase...
        </section>
      ) : null}

      {favorites.length > 0 ? (
        <section className="grid gap-4">
          {favorites.map((favorite) => (
            <article
              key={favorite.id}
              className="rounded-lg border border-border-subtle bg-bg-card p-5 shadow-2xl transition-colors hover:border-brand-primary/35"
            >
              <div className="grid gap-5 xl:grid-cols-[1fr_1.1fr_auto] xl:items-center">
                <div className="flex min-w-0 items-center gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-brand-primary/20 bg-brand-primary/10 text-xl font-black text-brand-primary">
                    {favorite.itemName.slice(0, 1)}
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate text-xl font-black text-white">{favorite.itemName}</h2>
                    <p className="mt-1 break-all font-mono text-xs text-zinc-500">{favorite.itemId}</p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg bg-zinc-950 p-3">
                    <p className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-zinc-500">
                      <Target size={13} />
                      Preço alvo
                    </p>
                    <p className="mt-1 font-black text-brand-primary">{formatSilver(favorite.targetPrice)}</p>
                  </div>
                  <div className="rounded-lg bg-zinc-950 p-3">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">Rota comercial</p>
                    <p className="mt-1 flex items-center gap-2 text-sm font-black text-white">
                      {formatCityName(favorite.buyCity)}
                      <ArrowRight size={14} className="text-brand-primary" />
                      {formatCityName(favorite.sellCity)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-status-success/10 p-3">
                    <p className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-status-success/80">
                      <TrendingUp size={13} />
                      Lucro esperado
                    </p>
                    <p className="mt-1 font-black text-status-success">
                      {formatSilver(favorite.expectedProfit)}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-3 xl:items-end">
                  <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                    <Badge variant={favorite.alertStatus ? 'success' : 'muted'}>
                      {favorite.alertStatus ? 'Alerta ativo' : 'Alerta inativo'}
                    </Badge>
                    <span className="flex items-center gap-1 text-xs font-bold text-zinc-500">
                      <Clock3 size={13} />
                      Atualizado {formatRelativeTime(favorite.updatedAt)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleAlert(favorite)}
                      className={cn(
                        'inline-flex h-10 w-10 items-center justify-center rounded-lg border transition-colors',
                        favorite.alertStatus
                          ? 'border-brand-primary/25 bg-brand-primary/10 text-brand-primary'
                          : 'border-border-subtle bg-zinc-900 text-zinc-500 hover:text-white',
                      )}
                      aria-label={favorite.alertStatus ? 'Desativar alerta' : 'Ativar alerta'}
                    >
                      {favorite.alertStatus ? <Bell size={18} /> : <BellOff size={18} />}
                    </button>
                    <Link
                      href={`/search?item=${encodeURIComponent(favorite.itemId)}`}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border-subtle bg-zinc-900 text-white transition-colors hover:border-brand-primary/40"
                      aria-label="Ver item"
                    >
                      <Eye size={18} />
                    </Link>
                    <button
                      type="button"
                      onClick={() => removeFavorite(favorite.id)}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-status-danger/20 bg-status-danger/10 text-status-danger transition-colors hover:bg-status-danger hover:text-white"
                      aria-label="Remover favorito"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section className="rounded-lg border border-border-subtle bg-bg-card p-8 text-center shadow-2xl">
          <Star className="mx-auto text-zinc-700" size={40} />
          <h2 className="mt-4 text-xl font-black text-white">Nenhum favorito monitorado</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-zinc-500">
            Use a busca de itens para escolher rotas e acompanhar oportunidades de preço.
          </p>
          <Link
            href="/search"
            className="mt-5 inline-flex items-center justify-center rounded-lg bg-brand-primary px-5 py-3 text-sm font-black text-bg-dark transition-colors hover:bg-brand-secondary"
          >
            Buscar itens
          </Link>
        </section>
      )}
    </div>
  );
}
