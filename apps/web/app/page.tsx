'use client'

import { Button } from '@ecowoods/ui'
import { ArrowRight, Star, Users, Award, Shield, Clock, MapPin, Leaf } from 'lucide-react'
import Link from 'next/link'
import { motion } from 'framer-motion'

export default function Home() {
  return (
    <div className="overflow-hidden">
      {/* Hero - Ultra Luxury */}
      <div className="relative h-[100dvh] flex items-center justify-center bg-[radial-gradient(#0A3D2E_0.5px,transparent_1.5px)] bg-[length:6px_6px]">
        <div className="absolute inset-0 bg-black/55" />
        
        <div className="relative z-10 text-center px-6 max-w-[1100px]">
          <div className="inline-flex items-center gap-4 bg-white/95 text-[#0A3D2E] px-7 py-2.5 rounded-full text-sm font-semibold mb-10 tracking-[1.5px]">
            <div className="w-3 h-3 bg-[#C5A26F] rounded-full animate-pulse" />
            TORONTO'S MOST EXCLUSIVE HARDWOOD PLATFORM
          </div>

          <h1 className="text-[82px] md:text-[128px] font-semibold tracking-tighter text-white leading-[0.88] mb-8">
            FLOORING.<br />REIMAGINED.
          </h1>
          
          <p className="text-[26px] md:text-[32px] text-white/90 max-w-4xl mx-auto mb-16 font-light tracking-tight">
            Get instant quotes from Toronto's most trusted pros.<br />Shop the world's most exquisite sustainable hardwood.
          </p>

          <div className="flex flex-col sm:flex-row gap-5 justify-center">
            <Button 
              onClick={() => window.location.href = '/jobs'} 
              className="group px-16 py-8 text-2xl bg-white text-[#0A3D2E] hover:bg-[#C5A26F] hover:text-white transition-all flex items-center gap-4 rounded-3xl font-semibold shadow-2xl"
            >
              Get Your Free Quote 
              <ArrowRight className="w-7 h-7 group-hover:-rotate-45 transition-transform" />
            </Button>
            
            <Button 
              onClick={() => window.location.href = '/products'}
              variant="outline"
              className="px-16 py-8 text-2xl border-[2.5px] border-white text-white hover:bg-white hover:text-[#0A3D2E] rounded-3xl font-semibold"
            >
              Explore The Collection
            </Button>
          </div>
        </div>

        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 flex flex-col items-center text-white/60 text-sm tracking-[3px]">
          SCROLL TO DISCOVER
          <motion.div animate={{ y: [0, 18, 0] }} transition={{ duration: 2.4, repeat: Infinity }} className="mt-4 text-2xl">
            ↓
          </motion.div>
        </div>
      </div>

      {/* Trust Bar */}
      <div className="border-b border-[#E5E5E5] py-9 bg-white">
        <div className="max-w-7xl mx-auto px-6 flex flex-wrap justify-center items-center gap-x-20 gap-y-6 text-sm opacity-90">
          <div className="flex items-center gap-4">
            <Award className="w-7 h-7 text-[#C5A26F]" /> 
            <span className="font-medium text-base">4.98/5 from 1,240+ reviews</span>
          </div>
          <div className="flex items-center gap-4">
            <Users className="w-7 h-7 text-[#C5A26F]" /> 
            <span className="font-medium text-base">87 verified pros</span>
          </div>
          <div className="flex items-center gap-4">
            <Shield className="w-7 h-7 text-[#C5A26F]" /> 
            <span className="font-medium text-base">100% Insured & Background-Checked</span>
          </div>
          <div className="flex items-center gap-4">
            <Clock className="w-7 h-7 text-[#C5A26F]" /> 
            <span className="font-medium text-base">Bids delivered in under 2 hours</span>
          </div>
        </div>
      </div>

      {/* Why EcoWoods - Elevated */}
      <div className="max-w-7xl mx-auto px-6 py-32">
        <div className="text-center mb-24">
          <div className="text-[#C5A26F] font-semibold tracking-[5px] text-sm mb-5">THE ECOWOODS STANDARD</div>
          <h2 className="text-[72px] font-semibold tracking-tighter">Everything you need.<br />Nothing you don't.</h2>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {[
            { 
              icon: "⚡", 
              title: "Instant Quotes", 
              desc: "Receive 3+ competitive bids from verified pros within 2 hours. No waiting. No hassle." 
            },
            { 
              icon: "🛡️", 
              title: "Verified Pros Only", 
              desc: "Every professional is personally vetted, background-checked, fully insured, and has a minimum 5-year track record." 
            },
            { 
              icon: "🌳", 
              title: "Sustainable Luxury", 
              desc: "Sourced exclusively from FSC-certified, carbon-negative forests. Traceable from forest to floor." 
            }
          ].map((feature, i) => (
            <motion.div 
              key={i} 
              whileHover={{ y: -16 }}
              className="group glass rounded-3xl p-16 border border-[#E5E5E5] hover:border-[#C5A26F] transition-all duration-500"
            >
              <div className="text-[78px] mb-12 group-hover:scale-110 transition-transform duration-700">{feature.icon}</div>
              <h3 className="text-[52px] font-semibold tracking-tight mb-8 leading-none">{feature.title}</h3>
              <p className="text-[22px] text-[#555] leading-tight">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* How It Works */}
      <div className="bg-white py-28 border-y border-[#E5E5E5]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
            <div className="text-[#C5A26F] font-semibold tracking-[4px] text-sm mb-4">SIMPLE. TRANSPARENT. FAST.</div>
            <h2 className="text-7xl font-semibold tracking-tighter">How EcoWoods Works</h2>
          </div>

          <div className="grid md:grid-cols-4 gap-8">
            {[
              { step: "01", title: "Tell Us About Your Project", desc: "Answer a few quick questions about your flooring needs." },
              { step: "02", title: "Receive Instant Quotes", desc: "Get 3+ competitive bids from pre-vetted local pros within 2 hours." },
              { step: "03", title: "Choose Your Pro", desc: "Review profiles, reviews, and portfolios. Pick the perfect match." },
              { step: "04", title: "Enjoy Your New Floors", desc: "Sit back while your floors are installed with white-glove service." }
            ].map((item, index) => (
              <div key={index} className="group">
                <div className="text-[92px] font-semibold text-[#C5A26F]/30 group-hover:text-[#C5A26F] transition-colors mb-4 tracking-tighter">{item.step}</div>
                <h4 className="text-4xl font-semibold tracking-tight mb-6">{item.title}</h4>
                <p className="text-xl text-[#555] leading-tight">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Final CTA */}
      <div className="bg-[#0A3D2E] py-28 text-white">
        <div className="max-w-5xl mx-auto text-center px-6">
          <div className="text-[#C5A26F] tracking-[3.5px] text-sm mb-6">YOUR HOME DESERVES THE BEST</div>
          <h2 className="text-[76px] font-semibold tracking-tighter mb-12 leading-none">Let's create something<br />truly extraordinary together.</h2>
          
          <Button 
            onClick={() => window.location.href = '/jobs'}
            className="px-20 py-9 text-[26px] bg-white text-[#0A3D2E] hover:bg-[#C5A26F] hover:text-white rounded-3xl font-semibold transition-all shadow-2xl mb-8"
          >
            Get Your Free Quote Now
          </Button>
          
          <p className="text-white/60 text-lg tracking-wide">No obligation. 100% free. Instant response guaranteed.</p>
        </div>
      </div>
    </div>
  )
}
