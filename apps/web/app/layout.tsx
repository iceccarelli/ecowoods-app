import type { Metadata } from 'next'
import './globals.css'
import { Toaster } from 'sonner'
import { Button } from '@ecowoods/ui'

export const metadata: Metadata = {
  title: 'EcoWoods | Premium Hardwood Flooring',
  description: 'Toronto\'s premier hardwood flooring platform. Get instant quotes, browse products, and connect with verified pros.',
  icons: { icon: '/favicon.ico' },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className="bg-[#F8F5F0] text-[#0A3D2E]">
        <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-[#E5E5E5]">
          <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-20">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-[#0A3D2E] rounded-xl flex items-center justify-center">
                <span className="text-white text-2xl">🌳</span>
              </div>
              <div>
                <div className="font-semibold text-2xl tracking-tight">EcoWoods</div>
                <div className="text-[10px] text-[#C5A26F] -mt-1">TORONTO</div>
              </div>
            </div>

            <div className="flex items-center gap-8 text-sm font-medium">
              <a href="/jobs" className="hover:text-[#C5A26F] transition-colors">Find Pros</a>
              <a href="/products" className="hover:text-[#C5A26F] transition-colors">Shop Products</a>
              <a href="/gallery" className="hover:text-[#C5A26F] transition-colors">Inspiration</a>
              <Button onClick={() => window.location.href = '/jobs'}>Get Instant Quote</Button>
            </div>
          </div>
        </nav>

        <main>{children}</main>

        <footer className="bg-[#0A3D2E] text-white py-16 mt-20">
          <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-12">
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center">🌳</div>
                <span className="font-semibold text-xl">EcoWoods</span>
              </div>
              <p className="text-white/60 text-sm">Premium hardwood flooring since 2012</p>
            </div>
            <div>
              <div className="font-semibold mb-4">Platform</div>
              <div className="space-y-2 text-sm text-white/70">
                <div>Browse Jobs</div>
                <div>Product Catalog</div>
                <div>Pro Network</div>
              </div>
            </div>
            <div>
              <div className="font-semibold mb-4">Company</div>
              <div className="space-y-2 text-sm text-white/70">
                <div>About Us</div>
                <div>Careers</div>
                <div>Press</div>
              </div>
            </div>
            <div>
              <div className="font-semibold mb-4">Legal</div>
              <div className="space-y-2 text-sm text-white/70">
                <div>Privacy</div>
                <div>Terms</div>
                <div>Trust & Safety</div>
              </div>
            </div>
          </div>
          <div className="mt-16 pt-8 border-t border-white/10 text-center text-xs text-white/50">
            © {new Date().getFullYear()} EcoWoods Inc. All rights reserved. Built with ❤️ in Toronto.
          </div>
        </footer>

        <Toaster position="top-center" richColors />
      </body>
    </html>
  )
}
