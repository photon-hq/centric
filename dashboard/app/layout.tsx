import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Support Agent Dashboard',
  description: 'Test the AI customer support agent',
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
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
