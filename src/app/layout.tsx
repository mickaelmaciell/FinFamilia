import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'FinFamília – Gestão Financeira Familiar',
  description: 'Gerencie as finanças da sua família de forma simples e colaborativa.',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'FinFamília' },
}

export const viewport: Viewport = {
  themeColor: '#F0EDE6',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} h-full`}>
      <body suppressHydrationWarning className="min-h-full antialiased">{children}</body>
    </html>
  )
}
