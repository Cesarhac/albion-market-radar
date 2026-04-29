'use client';

import React from 'react';
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import type { AlbionPlayerLookup, ServerParam, SubscriptionPlan, UserAccount } from '@/types/albion';
import { normalizeEmail, normalizePlayerName } from '@/lib/authStorage';
import {
  ensureUserSettings,
  getProfile,
  isSupabaseConfigured,
  upsertProfile,
} from '@/src/lib/supabase/database';
import { getBrowserSupabase } from '@/src/lib/supabase/client';
import { SUPABASE_NOT_CONFIGURED_MESSAGE } from '@/src/lib/supabase/env';

type RegisterUserInput = {
  playerName: string;
  email: string;
  password: string;
  server: ServerParam;
};

type LoginResult = {
  user: UserAccount;
};

type AuthOperationResult = {
  user: UserAccount;
  lookup: AlbionPlayerLookup;
};

type UpdateProfileInput = Partial<Pick<UserAccount, 'email' | 'playerName' | 'server' | 'plan' | 'subscriptionStatus'>>;

type AuthContextValue = {
  user: UserAccount | null;
  isAuthenticated: boolean;
  loading: boolean;
  configurationError: string;
  registerUser: (data: RegisterUserInput) => Promise<AuthOperationResult>;
  login: (email: string, password: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
  updateProfile: (data: UpdateProfileInput) => Promise<AuthOperationResult>;
  refreshAlbionPlayerData: (playerName: string) => Promise<AlbionPlayerLookup>;
  setDevelopmentPlan: (plan: SubscriptionPlan) => Promise<UserAccount>;
};

const AuthContext = React.createContext<AuthContextValue | null>(null);

const FALLBACK_LOOKUP: AlbionPlayerLookup = {
  found: false,
  warning: 'Não encontramos esse personagem na busca pública do Albion. Você pode continuar, mas confira se digitou corretamente.',
};

function createPendingUser(input: {
  id: string;
  email: string;
  playerName: string;
  server: ServerParam;
  playerId?: string;
  guildName?: string;
  allianceName?: string;
}): UserAccount {
  const now = new Date().toISOString();

  return {
    id: input.id,
    email: input.email,
    playerName: input.playerName,
    playerId: input.playerId,
    guildName: input.guildName,
    allianceName: input.allianceName,
    server: input.server,
    plan: 'free',
    subscriptionStatus: 'free',
    createdAt: now,
    lastLoginAt: now,
  };
}

function getMetadataString(user: User, key: string): string | undefined {
  const value = user.user_metadata?.[key];

  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function getMetadataServer(user: User): ServerParam {
  return getMetadataString(user, 'main_server') === 'europe' ? 'europe' : 'americas';
}

async function getOrCreateProfile(authUser: User): Promise<UserAccount | null> {
  const existingProfile = await getProfile(authUser.id, authUser);

  if (existingProfile) return existingProfile;

  const fallbackPlayerName =
    getMetadataString(authUser, 'player_name') ?? normalizePlayerName(authUser.email?.split('@')[0] ?? 'Jogador');
  const fallbackServer = getMetadataServer(authUser);
  const createdProfile = await upsertProfile({
    id: authUser.id,
    email: normalizeEmail(authUser.email ?? ''),
    playerName: fallbackPlayerName,
    playerId: getMetadataString(authUser, 'player_id'),
    guildName: getMetadataString(authUser, 'guild_name'),
    allianceName: getMetadataString(authUser, 'alliance_name'),
    server: fallbackServer,
    plan: 'free',
    subscriptionStatus: 'free',
  });

  await ensureUserSettings(createdProfile.id, fallbackServer);

  return createdProfile;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<UserAccount | null>(null);
  const [loading, setLoading] = React.useState(true);
  const configurationError = isSupabaseConfigured() ? '' : SUPABASE_NOT_CONFIGURED_MESSAGE;

  const loadCurrentUser = React.useCallback(async () => {
    const supabase = getBrowserSupabase();

    if (!supabase) {
      setUser(null);
      setLoading(false);
      return null;
    }

    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
      setUser(null);
      setLoading(false);
      return null;
    }

    const profile = await getOrCreateProfile(data.user);

    setUser(profile);
    setLoading(false);

    return profile;
  }, []);

  React.useEffect(() => {
    let isActive = true;
    const supabase = getBrowserSupabase();

    if (!supabase) {
      queueMicrotask(() => {
        if (!isActive) return;
        setUser(null);
        setLoading(false);
      });

      return () => {
        isActive = false;
      };
    }

    queueMicrotask(() => {
      void loadCurrentUser().catch(() => {
        if (!isActive) return;
        setUser(null);
        setLoading(false);
      });
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      if (!isActive) return;

      if (!session?.user) {
        setUser(null);
        setLoading(false);
        return;
      }

      void getOrCreateProfile(session.user)
        .then((profile) => {
          if (isActive) setUser(profile);
        })
        .catch(() => {
          if (isActive) setUser(null);
        });
    });

    return () => {
      isActive = false;
      subscription.subscription.unsubscribe();
    };
  }, [loadCurrentUser]);

  const refreshAlbionPlayerData = React.useCallback(async (playerName: string): Promise<AlbionPlayerLookup> => {
    const normalizedName = normalizePlayerName(playerName);

    if (!normalizedName) return FALLBACK_LOOKUP;

    try {
      const response = await fetch(`/api/albion/player-search?name=${encodeURIComponent(normalizedName)}`);

      if (!response.ok) return FALLBACK_LOOKUP;

      return (await response.json()) as AlbionPlayerLookup;
    } catch {
      return {
        ...FALLBACK_LOOKUP,
        warning: 'A busca pública do Albion oscilou. Você pode continuar e validar o nome mais tarde.',
      };
    }
  }, []);

  const registerUser = React.useCallback(
    async (data: RegisterUserInput): Promise<AuthOperationResult> => {
      const supabase = getBrowserSupabase();

      if (!supabase) throw new Error(SUPABASE_NOT_CONFIGURED_MESSAGE);

      const lookup = await refreshAlbionPlayerData(data.playerName);
      const playerName = lookup.found && lookup.playerName ? lookup.playerName : normalizePlayerName(data.playerName);
      const email = normalizeEmail(data.email);
      const { data: signUpData, error } = await supabase.auth.signUp({
        email,
        password: data.password,
        options: {
          data: {
            player_name: playerName,
            player_id: lookup.playerId,
            guild_name: lookup.guildName,
            alliance_name: lookup.allianceName,
            main_server: data.server,
          },
        },
      });

      if (error) throw error;
      if (!signUpData.user) throw new Error('Não foi possível criar a conta no Supabase.');

      const pendingUser = createPendingUser({
        id: signUpData.user.id,
        email,
        playerName,
        playerId: lookup.playerId,
        guildName: lookup.guildName,
        allianceName: lookup.allianceName,
        server: data.server,
      });

      if (!signUpData.session) {
        return {
          user: pendingUser,
          lookup: {
            ...lookup,
            warning:
              lookup.warning ??
              'Conta criada no Supabase. Se a confirmação por e-mail estiver ativa, confirme o e-mail antes de entrar.',
          },
        };
      }

      const nextUser = await upsertProfile({
        ...pendingUser,
        plan: 'free',
        subscriptionStatus: 'free',
      });

      await ensureUserSettings(nextUser.id, data.server);
      setUser(nextUser);

      return { user: nextUser, lookup };
    },
    [refreshAlbionPlayerData],
  );

  const login = React.useCallback(async (email: string, password: string): Promise<LoginResult> => {
    const supabase = getBrowserSupabase();

    if (!supabase) throw new Error(SUPABASE_NOT_CONFIGURED_MESSAGE);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizeEmail(email),
      password,
    });

    if (error || !data.user) {
      throw new Error('Conta não encontrada ou senha inválida.');
    }

    const profile = await getOrCreateProfile(data.user);

    if (!profile) throw new Error('Perfil não encontrado. Crie a conta novamente ou contate o suporte.');

    setUser(profile);

    return { user: profile };
  }, []);

  const logout = React.useCallback(async () => {
    const supabase = getBrowserSupabase();

    if (supabase) await supabase.auth.signOut();

    setUser(null);
  }, []);

  const updateProfile = React.useCallback(
    async (data: UpdateProfileInput): Promise<AuthOperationResult> => {
      const supabase = getBrowserSupabase();

      if (!supabase) throw new Error(SUPABASE_NOT_CONFIGURED_MESSAGE);

      const { data: authData } = await supabase.auth.getUser();
      const currentUser = user ?? (authData.user ? await getOrCreateProfile(authData.user) : null);

      if (!currentUser || !authData.user) throw new Error('Faça login para editar o perfil.');

      const requestedPlayerName = data.playerName ?? currentUser.playerName;
      const shouldRefreshPlayer = typeof data.playerName === 'string' || !currentUser.playerId;
      const lookup = shouldRefreshPlayer
        ? await refreshAlbionPlayerData(requestedPlayerName)
        : {
            found: Boolean(currentUser.playerId),
            playerName: currentUser.playerName,
            playerId: currentUser.playerId,
            guildName: currentUser.guildName,
            allianceName: currentUser.allianceName,
          };
      const nextEmail = data.email ? normalizeEmail(data.email) : currentUser.email;

      if (nextEmail && nextEmail !== currentUser.email) {
        const { error } = await supabase.auth.updateUser({ email: nextEmail });
        if (error) throw error;
      }

      const nextUser = await upsertProfile({
        id: currentUser.id,
        email: nextEmail,
        playerName:
          lookup.found && lookup.playerName
            ? lookup.playerName
            : normalizePlayerName(data.playerName ?? currentUser.playerName),
        playerId: lookup.playerId,
        guildName: lookup.guildName,
        allianceName: lookup.allianceName,
        server: data.server ?? currentUser.server,
        plan: data.plan ?? currentUser.plan,
        subscriptionStatus: data.subscriptionStatus ?? currentUser.subscriptionStatus,
      });

      setUser(nextUser);

      return { user: nextUser, lookup };
    },
    [refreshAlbionPlayerData, user],
  );

  const setDevelopmentPlan = React.useCallback(
    async (plan: SubscriptionPlan) => {
      const result = await updateProfile({
        plan,
        subscriptionStatus: plan === 'pro' ? 'active' : 'free',
      });

      return result.user;
    },
    [updateProfile],
  );

  const value = React.useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      loading,
      configurationError,
      registerUser,
      login,
      logout,
      updateProfile,
      refreshAlbionPlayerData,
      setDevelopmentPlan,
    }),
    [
      configurationError,
      loading,
      login,
      logout,
      refreshAlbionPlayerData,
      registerUser,
      setDevelopmentPlan,
      updateProfile,
      user,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = React.useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider.');
  }

  return context;
}
