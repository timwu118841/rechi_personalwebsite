import type { Metadata } from 'next'
import React from 'react'

import './globals.css'
import { getServerSideURL } from '@/utilities/getURL'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  )
}

export const metadata: Metadata = {
  metadataBase: new URL(getServerSideURL()),
  title: '法律筆記',
  description: '律師的實務筆記與法律觀察',
}
