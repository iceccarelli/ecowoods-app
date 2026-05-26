import { Button } from '@ecowoods/ui'
import { ArrowRight, Star, Users, Award } from 'lucide-react'

export default function Home() {
  return (
    <div>
      {/* Hero */}
      <div className="relative h-[90vh] flex items-center justify-center bg-[radial-gradient(#0A3D2E_0.8px,transparent_1px)] bg-[length:4px_4px]">
        <div className="absolute inset-0 bg-black/40" />
        
        <div className="relative z-10 text-center px-6 max-w-5xl">
          <div className="inline-flex items-center gap-2 bg-white/90 text-[#0A3D2E] px-4 py-1 rounded-full text-sm font-medium mb-6">
            <div className="w-2 h-2 bg-[#C5A26F] rounded-full animate-pulse" />
            TORONTO'S #1 HARDWOOD PLATFORM
          </div>

          <h1 className="text-7xl md:text-[92px] font-semibold tracking-tighter text-white leading-none mb-6">
            FLOORING.<br />REIMAGINED.
          </h1>
          
          <p className="text-2xl text-white/90 max-w-2xl mx-auto mb-12">
            Get instant quotes from verified pros.<br />Shop premium products. Love your floors.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              onClick={() => window.location.href = '/jobs'} 
              className="px-12 py-6 text-lg bg-white text-[#0A3D2E] hover:bg-[#C5A26F] hover:text-white transition-all flex items-center gap-3"
            >
              Get Your Free Quote <ArrowRight className="w-5 h-5" />
            </Button>
            <Button 
              onClick={() => window.location.href = '/products'}
              variant="outline"
              className="px-12 py-6 text-lg border-white text-white hover:bg-white hover:text-[#0A3D2E]"
            >
              Browse Products
            </Button>
          </div>
        </div>

        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 text-white/60 text-sm flex items-center gap-2">
          Scroll to explore <div className="w-px h-8 bg-white/30" />
        </div>
      </div>

      {/* Trust Bar */}
      <div className="border-b border-[#E5E5E5] py-6 bg-white">
        <div className="max-w-7xl mx-auto px-6 flex flex-wrap justify-center items-center gap-x-16 gap-y-4 opacity-60">
          <div className="flex items-center gap-3">
            <Award className="w-6 h-6" /> <span className="font-medium">4.98/5 from 1,240+ reviews</span>
          </div>
          <div className="flex items-center gap-3">
            <Users className="w-6 h-6" /> <span className="font-medium">87 verified pros</span>
          </div>
          <div className="flex items-center gap-3">
            <Star className="w-6 h-6" /> <span className="font-medium">Featured in House & Home</span>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="max-w-7xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <div className="text-[#C5A26F] font-semibold tracking-[3px] text-sm mb-4">WHY ECOWOODS</div>
          <h2 className="text-6xl font-semibold tracking-tighter">Everything you need.<br />Nothing you don't.</h2>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {[
            { icon: "⚡", title: "Instant Quotes", desc: "Get 3+ competitive bids within 2 hours" },
            { icon: "🛡️", title: "Verified Pros", desc: "Background-checked & insurance verified" },
            { icon: "🌳", title: "Premium Products", desc: "Direct from sustainable suppliers" }
          ].map((feature, i) => (
            <div key={i} className="glass rounded-3xl p-12 border border-[#E5E5E5] hover:border-[#C5A26F] transition-all group">
              <div className="text-6xl mb-8 group-hover:scale-110 transition-transform">{feature.icon}</div>
              <h3 className="text-4xl font-semibold tracking-tight mb-4">{feature.title}</h3>
              <p className="text-xl text-[#666]">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
