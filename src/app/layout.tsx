import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Clinic Management System',
  description: 'Backend Test Environment',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  )
}
