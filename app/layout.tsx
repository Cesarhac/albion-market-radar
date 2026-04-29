import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Sidebar } from '@/components/Sidebar';
import { AuthProvider } from '@/context/AuthContext';
import { UserSettingsProvider } from '@/context/UserSettingsContext';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Albion Market Radar',
    template: '%s | Albion Market Radar',
  },
  description:
    'Busque preços, encontre oportunidades e monte seu regear gastando menos no mercado de Albion Online.',
  applicationName: 'Albion Market Radar',
  icons: {
    icon: '/icon.svg',
  },
  openGraph: {
    title: 'Albion Market Radar',
    description:
      'Radar BR para buscar preços, encontrar oportunidades e montar seu regear gastando menos em Albion Online.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <body className="bg-bg-dark text-zinc-100 antialiased" suppressHydrationWarning>
        <AuthProvider>
          <UserSettingsProvider>
            <div className="min-h-screen lg:flex">
              <Sidebar />
              <main className="min-w-0 flex-1 lg:pl-64">
                <div className="mx-auto max-w-7xl px-4 pb-8 pt-20 sm:px-6 lg:px-8 lg:py-8">
                  <ProtectedRoute>{children}</ProtectedRoute>
                </div>
              </main>
            </div>
          </UserSettingsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
