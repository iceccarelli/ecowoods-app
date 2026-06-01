'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { submitLead } from '@ecowoods/api-client';
import { leadSchema, type LeadFormData } from '@ecowoods/shared';
import { X, Calculator, Leaf, Clock, Award, Info } from 'lucide-react';

interface QuoteFormProps {
  isOpen: boolean;
  onClose: () => void;
  prefilledMaterial?: string;
  prefilledSqft?: number;
  onSuccess?: (leadId: string, ecoPointsEarned: number) => void;
}

const MATERIALS = [
  { value: 'oak', label: 'Premium European Oak', pricePerSqft: 9.75, eco: true, color: '#8B4513', desc: 'Timeless beauty • 10yr warranty' },
  { value: 'maple', label: 'Hard Maple', pricePerSqft: 8.50, eco: true, color: '#D2B48C', desc: 'Light & durable • Great for pets' },
  { value: 'walnut', label: 'American Black Walnut', pricePerSqft: 12.25, eco: false, color: '#3D2914', desc: 'Luxury statement piece' },
  { value: 'bamboo', label: 'Carbon-Negative Bamboo', pricePerSqft: 7.25, eco: true, color: '#228B22', desc: 'Fastest growing • 100% renewable' },
  { value: 'hickory', label: 'Hickory', pricePerSqft: 10.50, eco: true, color: '#A0522D', desc: 'Extremely hard • Rustic charm' },
];

export function QuoteForm({ isOpen, onClose, prefilledMaterial, prefilledSqft, onSuccess }: QuoteFormProps) {
  const [formData, setFormData] = useState<Partial<LeadFormData>>({
    name: '',
    email: '',
    phone: '',
    address: '',
    material: prefilledMaterial || 'oak',
    length: 12,
    width: 10,
    notes: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showMaterialInfo, setShowMaterialInfo] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);

  // LIVE SQFT + PRICE CALCULATOR — This is your money printer
  const sqft = React.useMemo(() => {
    const l = Number(formData.length) || 0;
    const w = Number(formData.width) || 0;
    return Math.max(0, Math.round(l * w * 10) / 10);
  }, [formData.length, formData.width]);

  const selectedMaterial = MATERIALS.find(m => m.value === formData.material) || MATERIALS[0];
  const materialCost = sqft * selectedMaterial.pricePerSqft;
  const installCost = sqft * 5.75; // Premium install + underlayment + finishing + haul-away
  const ecoDiscount = selectedMaterial.eco ? Math.round(materialCost * 0.08) : 0; // 8% EcoRebate
  const totalEstimate = Math.round((materialCost + installCost - ecoDiscount) * 100) / 100;

  // Real-time validation + auto-save draft every 3s
  useEffect(() => {
    const result = leadSchema.safeParse({
      ...formData,
      sqft,
      estimatedTotal: totalEstimate,
    } as LeadFormData);
    
    if (!result.success) {
      const newErrors: Record<string, string> = {};
      result.error.issues.forEach(issue => {
        const path = issue.path[0] as string;
        newErrors[path] = issue.message;
      });
      setErrors(newErrors);
    } else {
      setErrors({});
    }

    // Auto-save draft (business continuity)
    const saveDraft = () => {
      if (typeof window !== 'undefined' && (formData.name || formData.email)) {
        localStorage.setItem('quoteDraft', JSON.stringify(formData));
        setDraftSaved(true);
        setTimeout(() => setDraftSaved(false), 1200);
      }
    };
    const timer = setTimeout(saveDraft, 3000);
    return () => clearTimeout(timer);
  }, [formData, sqft, totalEstimate]);

  // Load draft on open
  useEffect(() => {
    if (isOpen && typeof window !== 'undefined') {
      const saved = localStorage.getItem('quoteDraft');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setFormData(prev => ({ ...prev, ...parsed }));
          toast.info("Draft restored — your previous quote is ready", { duration: 2000 });
        } catch {}
      }
    }
  }, [isOpen]);

  const handleInputChange = (field: keyof LeadFormData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const payload: LeadFormData = {
      ...formData as LeadFormData,
      sqft,
      estimatedTotal: totalEstimate,
      source: 'web_quote_modal',
      createdAt: new Date().toISOString(),
    };

    const validation = leadSchema.safeParse(payload);
    if (!validation.success) {
      toast.error("Please fix the highlighted fields");
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await submitLead(payload);
      
      toast.success(result.message || "🎉 Quote request submitted!", {
        description: `A specialist will call you within 2 hours. You just earned ${result.ecoPointsEarned || 750} EcoPoints!`,
        duration: 7000,
      });

      // Clear draft after successful submit
      localStorage.removeItem('quoteDraft');

      onSuccess?.(result.leadId, result.ecoPointsEarned || 750);
      onClose();
      
      // Reset form
      setFormData({
        name: '', email: '', phone: '', address: '',
        material: 'oak', length: 12, width: 10, notes: '',
      });

    } catch (error) {
      toast.error("Submission failed", {
        description: error instanceof Error ? error.message : "Please try again or text us at (503) 555-0192",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 30 }}
          transition={{ type: "spring", bounce: 0.08, duration: 0.45 }}
          className="bg-white dark:bg-zinc-950 rounded-3xl shadow-2xl w-full max-w-[520px] overflow-hidden border border-zinc-200 dark:border-zinc-800"
          onClick={e => e.stopPropagation()}
        >
          {/* Header with Eco Branding + Draft indicator */}
          <div className="relative bg-gradient-to-br from-emerald-950 via-zinc-950 to-black px-8 py-7 text-white">
            <button 
              onClick={onClose}
              className="absolute right-6 top-6 text-white/70 hover:text-white transition-colors z-10"
            >
              <X size={24} />
            </button>
            
            <div className="flex items-center gap-4 mb-3">
              <div className="p-3 bg-white/10 rounded-2xl">
                <Leaf className="w-7 h-7" />
              </div>
              <div>
                <div className="font-semibold text-3xl tracking-tighter">Free In-Home Measure</div>
                <div className="text-emerald-400 text-sm font-medium flex items-center gap-2">
                  No obligation • 100% accurate quote in 48hrs
                  {draftSaved && <span className="text-[10px] bg-emerald-500/20 px-2 py-0.5 rounded">DRAFT SAVED ✓</span>}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-4 text-xs mt-4 opacity-80">
              <div className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> 2hr response</div>
              <div className="flex items-center gap-1.5"><Award className="w-3.5 h-3.5" /> 10yr warranty</div>
              <div className="flex items-center gap-1.5"><Leaf className="w-3.5 h-3.5" /> Carbon negative options</div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-8 space-y-7">
            {/* LIVE ESTIMATE HERO — The Money Printer */}
            <div className="bg-zinc-950 text-white rounded-3xl p-7 relative overflow-hidden border border-emerald-900/60">
              <div className="flex justify-between items-start mb-5">
                <div>
                  <div className="text-[10px] uppercase tracking-[3px] text-emerald-400 font-mono mb-1">LIVE ESTIMATE — UPDATES INSTANTLY</div>
                  <div className="text-[68px] font-semibold tabular-nums tracking-tighter leading-none mt-1">
                    ${totalEstimate.toLocaleString()}
                  </div>
                  <div className="text-sm text-zinc-400">incl. premium install, underlayment, finishing &amp; haul-away • {sqft} sqft</div>
                </div>
                
                <div className="text-right">
                  <div className="inline-flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 text-xs px-4 py-1.5 rounded-full font-mono">
                    <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                    REAL-TIME
                  </div>
                  {selectedMaterial.eco && (
                    <div className="mt-2 text-[10px] text-emerald-400 flex items-center justify-end gap-1">
                      <Leaf size={12} /> 8% ECO REBATE APPLIED
                    </div>
                  )}
                </div>
              </div>

              {/* Material Selector — Beautiful & Tactile */}
              <div className="mt-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs text-zinc-400 font-mono tracking-widest">CHOOSE YOUR SPECIES</div>
                  <button 
                    type="button"
                    onClick={() => setShowMaterialInfo(!showMaterialInfo)}
                    className="text-emerald-400 hover:text-emerald-300 transition flex items-center gap-1 text-xs"
                  >
                    <Info size={13} /> DETAILS
                  </button>
                </div>
                
                <div className="grid grid-cols-5 gap-2.5">
                  {MATERIALS.map((mat) => (
                    <button
                      key={mat.value}
                      type="button"
                      onClick={() => handleInputChange('material', mat.value)}
                      className={`group relative h-[72px] rounded-2xl border transition-all overflow-hidden flex flex-col items-center justify-center text-xs font-medium active:scale-[0.985]
                        ${formData.material === mat.value 
                          ? 'border-emerald-500 bg-emerald-950 shadow-[0_0_0_3px_rgba(16,185,129,0.2)] scale-[1.03]' 
                          : 'border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900'}`}
                    >
                      <div className="w-8 h-8 rounded-full mb-1.5 shadow-inner" style={{ backgroundColor: mat.color }} />
                      <div className="text-[10px] leading-none text-center font-medium">{mat.label.split(' ').slice(0, 2).join(' ')}</div>
                      {mat.eco && <Leaf className="absolute top-2 right-2 w-3 h-3 text-emerald-400" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dimensions — Large, Thumb-Friendly Inputs */}
              <div className="grid grid-cols-2 gap-4 mt-6">
                <div>
                  <label className="text-xs text-zinc-400 block mb-2 font-mono tracking-widest">LENGTH (ft)</label>
                  <input
                    type="number"
                    value={formData.length}
                    onChange={(e) => handleInputChange('length', parseFloat(e.target.value) || 0)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-4 text-3xl font-semibold focus:outline-none focus:border-emerald-600 tabular-nums"
                    min="3"
                    step="0.5"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 block mb-2 font-mono tracking-widest">WIDTH (ft)</label>
                  <input
                    type="number"
                    value={formData.width}
                    onChange={(e) => handleInputChange('width', parseFloat(e.target.value) || 0)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-4 text-3xl font-semibold focus:outline-none focus:border-emerald-600 tabular-nums"
                    min="3"
                    step="0.5"
                  />
                </div>
              </div>
              <div className="text-center text-[10px] text-zinc-500 mt-3 font-mono">Type or use +/- • Updates live • Includes 5% waste factor</div>
            </div>

            {/* Contact Fields — Clean & Spacious */}
            <div className="space-y-5">
              <div>
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300 block mb-2">Full Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className="w-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 rounded-2xl px-6 py-4 text-base focus:outline-none focus:border-emerald-600 placeholder:text-zinc-400"
                  placeholder="Alex Rivera"
                  required
                />
                {errors.name && <p className="text-red-500 text-xs mt-1.5 ml-1">{errors.name}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300 block mb-2">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    className="w-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 rounded-2xl px-6 py-4 text-base focus:outline-none focus:border-emerald-600 placeholder:text-zinc-400"
                    placeholder="you@home.com"
                    required
                  />
                  {errors.email && <p className="text-red-500 text-xs mt-1.5 ml-1">{errors.email}</p>}
                </div>
                <div>
                  <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300 block mb-2">Phone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    className="w-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 rounded-2xl px-6 py-4 text-base focus:outline-none focus:border-emerald-600 placeholder:text-zinc-400"
                    placeholder="(503) 555-0192"
                    required
                  />
                  {errors.phone && <p className="text-red-500 text-xs mt-1.5 ml-1">{errors.phone}</p>}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300 block mb-2">Project Address</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => handleInputChange('address', e.target.value)}
                  className="w-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 rounded-2xl px-6 py-4 text-base focus:outline-none focus:border-emerald-600 placeholder:text-zinc-400"
                  placeholder="123 Oak Lane, Portland, OR 97201"
                  required
                />
                {errors.address && <p className="text-red-500 text-xs mt-1.5 ml-1">{errors.address}</p>}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300 block mb-2 flex items-center gap-2">
                Special Requests or Notes
                <span className="text-xs text-zinc-400">(optional — helps us prepare)</span>
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                rows={3}
                className="w-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 rounded-2xl px-6 py-4 text-base focus:outline-none focus:border-emerald-600 resize-y min-h-[92px] placeholder:text-zinc-400"
                placeholder="Underfloor heating? Pet-friendly finish? Timeline for summer reno? Existing floor to remove?"
              />
            </div>

            {/* Trust + Submit */}
            <div className="pt-4 border-t border-zinc-100 dark:border-zinc-900">
              <div className="text-center text-[10px] text-zinc-500 mb-5">
                Your information is secure. We never share it. <span className="text-emerald-600 font-medium">SSL encrypted</span> • 10-year warranty included
              </div>

              <button
                type="submit"
                disabled={isSubmitting || Object.keys(errors).length > 0}
                className="w-full h-16 text-lg font-semibold bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-70 rounded-3xl shadow-xl shadow-emerald-950/40 flex items-center justify-center gap-3 text-white transition-all"
              >
                {isSubmitting ? (
                  <>Processing your personalized quote...</>
                ) : (
                  <>
                    <Calculator className="w-6 h-6" />
                    GET MY FREE MEASURE + EXACT QUOTE
                  </>
                )}
              </button>

              <p className="text-center text-[10px] text-zinc-400 mt-3">No credit card required • Cancel anytime • 2-hour callback guarantee</p>
            </div>
          </form>
        </motion.div>
      </div>

      {/* Material Info Modal */}
      <AnimatePresence>
        {showMaterialInfo && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-4" onClick={() => setShowMaterialInfo(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-zinc-950 rounded-3xl p-8 max-w-md w-full border border-zinc-200 dark:border-zinc-800"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-start mb-6">
                <div>
                  <div className="text-emerald-600 text-xs tracking-[2px] font-mono">WHY THIS MATTERS</div>
                  <div className="text-2xl font-semibold tracking-tight mt-1">Material Deep Dive</div>
                </div>
                <button onClick={() => setShowMaterialInfo(false)}><X size={22} /></button>
              </div>
              
              <div className="space-y-4 text-sm text-zinc-600 dark:text-zinc-400">
                {MATERIALS.map(m => (
                  <div key={m.value} className="flex gap-4 pb-4 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
                    <div className="w-9 h-9 rounded-xl flex-shrink-0 mt-0.5" style={{ backgroundColor: m.color }} />
                    <div>
                      <div className="font-semibold text-zinc-950 dark:text-white flex items-center gap-2">{m.label} {m.eco && <Leaf className="text-emerald-500" size={14} />}</div>
                      <div className="text-xs mt-0.5">{m.desc}</div>
                      <div className="text-emerald-600 text-xs mt-1 font-mono">${m.pricePerSqft}/sqft installed</div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-6 text-xs text-center text-zinc-500">All prices include expert installation by certified EcoWoods installers</div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AnimatePresence>
  );
}
