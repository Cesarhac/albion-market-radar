import type { AuthSession, ServerParam, UserAccount } from '@/types/albion';

export const AUTH_USER_STORAGE_KEY = 'albion-market-radar:auth-user';
export const AUTH_SESSION_STORAGE_KEY = 'albion-market-radar:auth-session';

type StoredAuthUser = UserAccount & {
  passwordHash?: string;
};

export function getStoredUser(): UserAccount | null {
  return getStoredAuthUser();
}

export function getStoredAuthUser(): StoredAuthUser | null {
  if (typeof window === 'undefined') return null;

  try {
    const rawValue = window.localStorage.getItem(AUTH_USER_STORAGE_KEY);
    if (!rawValue) return null;

    return normalizeStoredUser(JSON.parse(rawValue));
  } catch {
    return null;
  }
}

export function saveStoredUser(user: UserAccount, password?: string): UserAccount {
  const currentUser = getStoredAuthUser();
  const userToStore: StoredAuthUser = {
    ...user,
    passwordHash: password !== undefined ? createLocalPasswordHash(password) : currentUser?.passwordHash,
  };

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(userToStore));
  }

  return stripPasswordHash(userToStore);
}

export function verifyStoredPassword(email: string, password: string): UserAccount | null {
  const storedUser = getStoredAuthUser();

  if (!storedUser) return null;
  if (storedUser.email.toLowerCase() !== email.trim().toLowerCase()) return null;
  if (!storedUser.passwordHash || storedUser.passwordHash !== createLocalPasswordHash(password)) return null;

  return stripPasswordHash(storedUser);
}

export function getStoredSession(): AuthSession | null {
  if (typeof window === 'undefined') return null;

  try {
    const rawValue = window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
    if (!rawValue) return null;

    return normalizeSession(JSON.parse(rawValue));
  } catch {
    return null;
  }
}

export function saveStoredSession(session: AuthSession): AuthSession {
  const normalizedSession = normalizeSession(session);

  if (typeof window !== 'undefined' && normalizedSession) {
    window.localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(normalizedSession));
  }

  return normalizedSession ?? session;
}

export function clearSession() {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
  }
}

export function clearUser() {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(AUTH_USER_STORAGE_KEY);
  }
}

export function createSessionForUser(user: UserAccount): AuthSession {
  return {
    userId: user.id,
    email: user.email,
    playerName: user.playerName,
    createdAt: new Date().toISOString(),
  };
}

export function createLocalPasswordHash(password: string): string {
  const normalizedPassword = encodeURIComponent(password);

  if (typeof btoa === 'function') {
    return `local-v1:${btoa(normalizedPassword).split('').reverse().join('')}`;
  }

  return `local-v1:${normalizedPassword.split('').reverse().join('')}`;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizePlayerName(playerName: string): string {
  return playerName.trim();
}

function normalizeStoredUser(value: unknown): StoredAuthUser | null {
  if (!value || typeof value !== 'object') return null;

  const candidate = value as Partial<StoredAuthUser>;
  const email = typeof candidate.email === 'string' ? normalizeEmail(candidate.email) : '';
  const playerName = typeof candidate.playerName === 'string' ? normalizePlayerName(candidate.playerName) : '';
  const server = normalizeServer(candidate.server);

  if (!email || !playerName || !server) return null;

  return {
    id: typeof candidate.id === 'string' && candidate.id ? candidate.id : `user-${email}`,
    email,
    playerName,
    playerId: normalizeOptionalString(candidate.playerId),
    guildName: normalizeOptionalString(candidate.guildName),
    allianceName: normalizeOptionalString(candidate.allianceName),
    server,
    plan: candidate.plan === 'pro' ? 'pro' : 'free',
    subscriptionStatus: normalizeSubscriptionStatus(candidate.subscriptionStatus),
    stripeCustomerId: normalizeOptionalString(candidate.stripeCustomerId),
    stripeSubscriptionId: normalizeOptionalString(candidate.stripeSubscriptionId),
    stripePriceId: normalizeOptionalString(candidate.stripePriceId),
    subscriptionCurrentPeriodEnd: normalizeOptionalString(candidate.subscriptionCurrentPeriodEnd),
    createdAt: normalizeDate(candidate.createdAt),
    updatedAt: normalizeOptionalString(candidate.updatedAt),
    lastLoginAt: normalizeDate(candidate.lastLoginAt),
    passwordHash: normalizeOptionalString(candidate.passwordHash),
  };
}

function normalizeSession(value: unknown): AuthSession | null {
  if (!value || typeof value !== 'object') return null;

  const candidate = value as Partial<AuthSession>;
  const email = typeof candidate.email === 'string' ? normalizeEmail(candidate.email) : '';
  const playerName = typeof candidate.playerName === 'string' ? normalizePlayerName(candidate.playerName) : '';

  if (!candidate.userId || !email || !playerName) return null;

  return {
    userId: candidate.userId,
    email,
    playerName,
    createdAt: normalizeDate(candidate.createdAt),
  };
}

function stripPasswordHash(user: StoredAuthUser): UserAccount {
  const { passwordHash: _passwordHash, ...account } = user;

  return account;
}

function normalizeServer(value: unknown): ServerParam | null {
  if (value === 'americas' || value === 'europe') return value;

  return null;
}

function normalizeSubscriptionStatus(value: unknown): UserAccount['subscriptionStatus'] {
  if (
    value === 'active' ||
    value === 'trialing' ||
    value === 'past_due' ||
    value === 'canceled' ||
    value === 'unpaid' ||
    value === 'incomplete' ||
    value === 'incomplete_expired' ||
    value === 'inactive' ||
    value === 'paused'
  ) {
    return value;
  }

  return 'free';
}

function normalizeOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function normalizeDate(value: unknown): string {
  const timestamp = typeof value === 'string' ? new Date(value).getTime() : Number.NaN;

  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : new Date().toISOString();
}
