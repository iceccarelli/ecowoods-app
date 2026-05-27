import type { Metadata } from 'next'
import Link from 'next/link'
import './globals.css'
import { Toaster } from 'sonner'

export const metadata: Metadata = {
  title: 'EcoWoods | Premium Hardwood Flooring | Toronto',
  description: 'Toronto\'s premier hardwood flooring platform. Get instant quotes from verified pros, shop the world\'s finest sustainable hardwood, and transform your home with timeless luxury.',
  icons: { icon: '/favicon.ico' },
  openGraph: {
    title: 'EcoWoods | Premium Hardwood Flooring',
    description: 'Toronto\'s #1 hardwood flooring platform — instant quotes, verified pros, premium sustainable products.',
    images: [{ url: 'https://ecowoods.ca/og-image.jpg' }],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className="bg-[#F8F5F0] text-[#0A3D2E] font-sans antialiased">
        {/* Ultra-Premium Sticky Navigation */}
        <nav className="sticky top-0 z-[100] bg-white/95 backdrop-blur-2xl border-b border-[#E5E5E5]">
          <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-20">
            <Link href="/" className="flex items-center gap-4 group">
              <div className="w-11 h-11 bg-[#0A3D2E] rounded-2xl flex items-center justify-center group-hover:rotate-[20deg] transition-transform duration-500">
                <span className="text-white text-4xl">🌳</span>
              </div>
              <div>
                <div className="font-semibold text-[34px] tracking-[-2.5px] leading-none">EcoWoods</div>
                <div className="text-[9px] text-[#C5A26F] tracking-[3.5px] -mt-1">EST 2012 • TORONTO</div>
              </div>
            </Link>

            <div className="hidden md:flex items-center gap-9 text-[15px] font-medium">
              <Link href="/jobs" className="hover:text-[#C5A26F] transition-all duration-200">Find Pros</Link>
              <Link href="/products" className="hover:text-[#C5A26F] transition-all duration-200">Shop Collection</Link>
              <Link href="/gallery" className="hover:text-[#C5A26F] transition-all duration-200">Inspiration</Link>
              <Link href="/about" className="hover:text-[#C5A26F] transition-all duration-200">Our Craft</Link>
            </div>

            <div className="flex items-center gap-4">
              <Link 
                href="/jobs" 
                className="hidden lg:block px-7 py-3 rounded-2xl border border-[#0A3D2E] text-sm font-semibold hover:bg-[#0A3D2E] hover:text-white transition-all"
              >
                Find Pros
              </Link>
              <Link 
                href="/jobs" 
                className="px-9 py-3 rounded-2xl bg-[#0A3D2E] text-white text-sm font-semibold hover:bg-[#C5A26F] active:scale-[0.985] transition-all flex items-center gap-2 shadow-lg"
              >
                Get Instant Quote
              </Link>
            </div>
          </div>
        </nav>

        <main>{children}</main>

        {/* Ultra-Premium Footer */}
        <footer className="bg-[#0A3D2E] text-white pt-24 pb-16">
          <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-12 gap-y-20">
            <div className="md:col-span-5 pr-8">
              <div className="flex items-center gap-5 mb-10">
                <div className="w-14 h-14 bg-white/10 rounded-3xl flex items-center justify-center">
                  <span className="text-[52px]">🌳</span>
                </div>
                <div>
                  <div className="font-semibold text-[42px] tracking-tighter">EcoWoods</div>
                  <div className="text-[#C5A26F] text-sm tracking-[4px] -mt-1">TORONTO • EST 2012</div>
                </div>
              </div>
              <p className="max-w-md text-white/75 text-[17px] leading-relaxed">
                For over a decade, we have been the trusted partner for Toronto's most discerning homeowners and architects seeking the world's finest hardwood.
              </p>
            </div>

            <div className="md:col-span-3">
              <div className="font-semibold text-xl mb-8 tracking-tight">Platform</div>
              <div className="space-y-4 text-[15px] text-white/80">
                <Link href="/jobs" className="block hover:text-white transition-colors">Find Verified Pros</Link>
                <Link href="/products" className="block hover:text-white transition-colors">Premium Hardwood Collection</Link>
                <Link href="/gallery" className="block hover:text-white transition-colors">Signature Projects</Link>
                <Link href="/quote" className="block hover:text-white transition-colors">Instant Quote Tool</Link>
              </div>
            </div>

            <div className="md:col-span-4">
              <div className="font-semibold text-xl mb-8 tracking-tight">Company</div>
              <div className="space-y-4 text-[15px] text-white/80">
                <div>Our Sustainable Mission</div>
                <div>The EcoWoods Craftsmanship Story</div>
                <div>Careers at EcoWoods</div>
                <div>Press &amp; Media</div>
                <div className="pt-6 text-xs text-white/50">Handcrafted with ❤️ in Toronto, Canada</div>
              </div>
            </div>
          </div>

          <div className="mt-24 pt-10 border-t border-white/10 text-center text-xs text-white/50 tracking-widest max-w-7xl mx-auto px-6">
            © {new Date().getFullYear()} EcoWoods Inc. All rights reserved. • Premium hardwood, responsibly sourced from sustainable forests.
          </div>
        </footer>

        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  )
}
