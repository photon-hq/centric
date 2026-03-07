import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Support Agent Dashboard',
  description: 'AI customer support agent dashboard',
  icons: {
    icon: '/photon-logo.png',
    apple: '/photon-logo.png'
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-black text-white antialiased">{children}</body>
    </html>
  )
}
