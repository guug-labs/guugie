import type { Metadata, Viewport } from 'next'
import './globals.css'

// 1. SETTING VIEWPORT (WAJIB Buat Mobile-First & Anti-Zoom)
export const viewport: Viewport = {
  themeColor: '#0a0a0a', // Warna bar status HP (Sinkron sama Background lu)
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover', // Biar UI lu "nembus" sampe ke area Notch iPhone
}

// 2. METADATA ELIT
export const metadata: Metadata = {
  title: 'Guugie by GUUG Labs',
  description: 'Asisten Riset Akademik Profesional',
  manifest: '/manifest.json', // Persiapan biar bisa di-install jadi aplikasi (PWA)
  icons: {
    icon: '/favicon.png',
    apple: '/favicon.png', // Biar pas di-save di iPhone, icon-nya muncul cakep
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Guugie Labs',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark scroll-smooth">
      <body className="antialiased font-sans bg-[#0a0a0a] text-[#ededed] selection:bg-white/10 selection:text-white">
        {/* Konten Utama */}
        {children}
      </body>
    </html>
  )
}