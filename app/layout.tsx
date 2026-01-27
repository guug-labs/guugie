import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Guugie by GUUG Labs',
  description: 'Asisten Riset Akademik Profesional',
  icons: {
    icon: '/favicon.png', // Pastikan file telur kecil ada di folder public
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="antialiased font-sans">
        {children}
      </body>
    </html>
  )
}