'use client';

import React from 'react';
import { useAuth } from '@/context/AuthContext';
import type { UserSettings } from '@/types/settings';
import {
  DEFAULT_USER_SETTINGS,
  getStoredSettings,
  mergeWithDefaultSettings,
  saveStoredSettings,
} from '@/lib/settingsStorage';
import {
  ensureUserSettings,
  getUserSettings,
  isSupabaseConfigured,
  upsertUserSettings,
} from '@/src/lib/supabase/database';

type UserSettingsContextValue = {
  settings: UserSettings;
  isLoaded: boolean;
  saveSettings: (settings: UserSettings) => UserSettings;
  resetSettings: () => UserSettings;
};

const UserSettingsContext = React.createContext<UserSettingsContextValue | null>(null);

export function UserSettingsProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [settings, setSettings] = React.useState<UserSettings>(DEFAULT_USER_SETTINGS);
  const [isLoaded, setIsLoaded] = React.useState(false);

  React.useEffect(() => {
    let isActive = true;

    async function loadSettings() {
      if (authLoading) return;

      setIsLoaded(false);

      if (user && isSupabaseConfigured()) {
        try {
          const storedSettings = (await getUserSettings(user.id)) ?? (await ensureUserSettings(user.id, user.server));

          if (!isActive) return;
          setSettings(storedSettings);
          setIsLoaded(true);
          return;
        } catch {
          // Local fallback keeps the interface usable if Supabase is temporarily unavailable.
        }
      }

      const localSettings = getStoredSettings();
      const fallbackSettings = user
        ? mergeWithDefaultSettings({ ...localSettings, defaultServer: user.server })
        : localSettings;

      if (!isActive) return;
      setSettings(fallbackSettings);
      setIsLoaded(true);
    }

    void loadSettings();

    return () => {
      isActive = false;
    };
  }, [authLoading, user]);

  const saveSettings = React.useCallback(
    (nextSettings: UserSettings) => {
      const savedSettings = mergeWithDefaultSettings(nextSettings);

      setSettings(savedSettings);

      if (user && isSupabaseConfigured()) {
        void upsertUserSettings(user.id, savedSettings).catch(() => {
          saveStoredSettings(savedSettings);
        });
      } else {
        saveStoredSettings(savedSettings);
      }

      return savedSettings;
    },
    [user],
  );

  const resetSettings = React.useCallback(() => {
    const defaultSettings = mergeWithDefaultSettings({
      ...DEFAULT_USER_SETTINGS,
      defaultServer: user?.server ?? DEFAULT_USER_SETTINGS.defaultServer,
    });

    setSettings(defaultSettings);

    if (user && isSupabaseConfigured()) {
      void upsertUserSettings(user.id, defaultSettings).catch(() => {
        saveStoredSettings(defaultSettings);
      });
    } else {
      saveStoredSettings(defaultSettings);
    }

    return defaultSettings;
  }, [user]);

  const value = React.useMemo(
    () => ({
      settings,
      isLoaded,
      saveSettings,
      resetSettings,
    }),
    [isLoaded, resetSettings, saveSettings, settings],
  );

  return <UserSettingsContext.Provider value={value}>{children}</UserSettingsContext.Provider>;
}

export function useUserSettings() {
  const context = React.useContext(UserSettingsContext);

  if (!context) {
    throw new Error('useUserSettings deve ser usado dentro de UserSettingsProvider.');
  }

  return context;
}
