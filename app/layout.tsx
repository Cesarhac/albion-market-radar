import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Sidebar } from '@/components/Sidebar';
import { AlertsProvider } from '@/context/AlertsContext';
import { AuthProvider } from '@/context/AuthContext';
import { UserSettingsProvider } from '@/context/UserSettingsContext';
import { APP_DESCRIPTION, APP_NAME, APP_TITLE_TEMPLATE } from '@/lib/branding';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: APP_NAME,
    template: APP_TITLE_TEMPLATE,
  },
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  icons: {
    icon: '/icon.svg',
  },
  openGraph: {
    title: APP_NAME,
    description: APP_DESCRIPTION,
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <body className="bg-bg-dark text-zinc-100 antialiased" suppressHydrationWarning>
        <AuthProvider>
          <UserSettingsProvider>
            <AlertsProvider>
              <div className="min-h-screen lg:flex">
                <Sidebar />
                <main className="min-w-0 flex-1 lg:pl-64">
                  <div className="mx-auto max-w-7xl px-4 pb-8 pt-20 sm:px-6 lg:px-8 lg:py-8">
                    <ProtectedRoute>{children}</ProtectedRoute>
                  </div>
                </main>
              </div>
            </AlertsProvider>
          </UserSettingsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
