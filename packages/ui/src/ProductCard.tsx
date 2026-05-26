'use client';

import React from 'react';
import { Product } from '@ecowoods/types';
import { toast } from 'sonner';
import { ShoppingCart } from 'lucide-react';

interface ProductCardProps {
  product: Product;
}

export const ProductCard = ({ product }: ProductCardProps) => {
  const handleAddToQuote = () => {
    toast.success(`${product.name} added to your quote!`, {
      description: "Our team will contact you within 2 hours with pricing.",
      action: {
        label: "View Quote",
        onClick: () => window.location.href = '/jobs',
      },
    });
  };

  return (
    <div className="group bg-white rounded-3xl overflow-hidden border border-[#E5E5E5] hover:border-[#C5A26F] transition-all hover:shadow-2xl flex flex-col">
      <div className="relative h-72 bg-[#F8F5F0] overflow-hidden">
        <img 
          src={product.image_url || 'https://picsum.photos/id/1015/600/400'} 
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
        />
        
        <div className="absolute top-4 right-4 bg-white/95 px-4 py-1.5 rounded-full text-xs font-semibold text-[#0A3D2E] shadow-sm flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 bg-[#C5A26F] rounded-full" />
          {product.category}
        </div>
      </div>
      
      <div className="p-8 flex flex-col flex-1">
        <div className="flex-1">
          <h3 className="font-semibold text-3xl tracking-[-0.5px] mb-4 leading-none pr-8">
            {product.name}
          </h3>
          
          <div className="flex items-baseline gap-2 mb-6">
            <span className="text-5xl font-semibold text-[#0A3D2E] tracking-tighter">
              ${product.price}
            </span>
            <span className="text-lg text-[#666]">CAD</span>
          </div>
        </div>

        <button 
          onClick={handleAddToQuote}
          className="w-full py-4 bg-[#0A3D2E] hover:bg-[#C5A26F] active:bg-[#0A3D2E] text-white font-semibold text-lg rounded-2xl transition-all flex items-center justify-center gap-3 active:scale-[0.985] shadow-lg hover:shadow-xl group-hover:bg-[#C5A26F]"
        >
          <ShoppingCart className="w-5 h-5" />
          Add to Quote
        </button>
      </div>
    </div>
  );
};
