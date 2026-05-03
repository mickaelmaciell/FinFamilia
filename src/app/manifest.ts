import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'FinFamília – Gestão Financeira Familiar',
    short_name: 'FinFamília',
    description: 'Gerencie as finanças da sua família de forma simples e colaborativa.',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#F0EDE6',
    theme_color: '#243D22',
    orientation: 'portrait-primary',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  }
}
