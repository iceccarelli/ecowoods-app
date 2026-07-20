'use client';

/**
 * Inline "browse → cart → checkout" shop section for the customer dashboard.
 * Prices are always recomputed server-side in /api/shop/checkout before a
 * Stripe Checkout session is created — client-side totals here are for
 * display/estimation only.
 */

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Image, { type StaticImageData } from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { BLUR_WARM, IMG_SIZES } from '@/lib/image';
import { parseProductOptions, resolveSelectedOptions, round2, type ShopOptionGroup } from '@/lib/shop';

// Product photos aren't ready yet — reserve the space, but don't render them.
// Flip to true once real images are in place.
const SHOW_PRODUCT_IMAGES = false;

export type ShopImage = {
  src: string | StaticImageData;
  credit: string | null;
  creditUrl: string | null;
};

export type ShopProduct = {
  id: string;
  name: string;
  category: 'MATERIAL' | 'ACCESSORY';
  unit: 'SQFT' | 'EACH';
  basePrice: number;
  minQuantity: number;
  species: string | null;
  format: string | null;
  janka: number | null;
  description: string | null;
  options: ShopOptionGroup[];
  image: ShopImage | null;
};

type CartItem = {
  productId: string;
  name: string;
  unit: 'SQFT' | 'EACH';
  quantity: number;
  selectedOptions: Record<string, string>;
  unitPrice: number;
  lineTotal: number;
  image: ShopImage | null;
};

type Selection = { quantity: number; selectedOptions: Record<string, string> };

const CART_STORAGE_KEY = 'ecowoods-shop-cart';

function formatCAD(amount: number) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(amount);
}

function unitLabel(unit: 'SQFT' | 'EACH') {
  return unit === 'SQFT' ? 'sq ft' : 'each';
}

function computeUnitPrice(product: ShopProduct, selectedOptions: Record<string, string>) {
  const resolved = resolveSelectedOptions(product.options, selectedOptions);
  const delta = resolved.reduce((sum, o) => sum + o.priceDelta, 0);
  return round2(product.basePrice + delta);
}

function defaultSelection(product: ShopProduct): Selection {
  const selectedOptions: Record<string, string> = {};
  for (const group of product.options) {
    if (group.choices[0]) selectedOptions[group.name] = group.choices[0].label;
  }
  return { quantity: product.minQuantity, selectedOptions };
}

function scrollTrack(ref: React.RefObject<HTMLDivElement | null>, direction: 1 | -1) {
  const el = ref.current;
  if (!el) return;
  el.scrollBy({ left: direction * el.clientWidth * 0.85, behavior: 'smooth' });
}

export default function ShopCheckout(props: { products: ShopProduct[]; taxRatePercent: number }) {
  return (
    <Suspense fallback={null}>
      <ShopCheckoutInner {...props} />
    </Suspense>
  );
}

function ShopCheckoutInner({
  products,
  taxRatePercent,
}: {
  products: ShopProduct[];
  taxRatePercent: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const productTrackRef = useRef<HTMLDivElement>(null);
  const cartTrackRef = useRef<HTMLDivElement>(null);

  const [category, setCategory] = useState<'MATERIAL' | 'ACCESSORY'>('MATERIAL');
  const [selections, setSelections] = useState<Record<string, Selection>>(() =>
    Object.fromEntries(products.map((p) => [p.id, defaultSelection(p)]))
  );
  const [cart, setCart] = useState<CartItem[]>([]);
  const [checkingOut, setCheckingOut] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Restore cart from this tab's session on first render.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(CART_STORAGE_KEY);
      if (raw) setCart(JSON.parse(raw));
    } catch {
      // ignore malformed storage
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    sessionStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  }, [cart, hydrated]);

  useEffect(() => {
    const order = searchParams.get('order');
    if (order === 'success') {
      toast.success('Order placed! We’ll be in touch to confirm delivery/install details.');
      setCart([]);
      sessionStorage.removeItem(CART_STORAGE_KEY);
      router.replace('/mypage');
    } else if (order === 'cancelled') {
      toast('Checkout cancelled — your cart is still saved.');
      router.replace('/mypage');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const visibleProducts = useMemo(
    () => products.filter((p) => p.category === category),
    [products, category]
  );

  function updateSelection(productId: string, patch: Partial<Selection>) {
    setSelections((prev) => ({
      ...prev,
      [productId]: { ...prev[productId], ...patch },
    }));
  }

  function addToCart(product: ShopProduct) {
    const selection = selections[product.id] ?? defaultSelection(product);
    const quantity = Math.max(product.minQuantity, Number(selection.quantity) || product.minQuantity);
    const unitPrice = computeUnitPrice(product, selection.selectedOptions);
    const lineTotal = round2(unitPrice * quantity);

    setCart((prev) => {
      const existingIndex = prev.findIndex(
        (item) =>
          item.productId === product.id &&
          JSON.stringify(item.selectedOptions) === JSON.stringify(selection.selectedOptions)
      );
      if (existingIndex >= 0) {
        const next = [...prev];
        const merged = next[existingIndex];
        const mergedQty = merged.quantity + quantity;
        next[existingIndex] = { ...merged, quantity: mergedQty, lineTotal: round2(merged.unitPrice * mergedQty) };
        return next;
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          unit: product.unit,
          quantity,
          selectedOptions: selection.selectedOptions,
          unitPrice,
          lineTotal,
          image: product.image,
        },
      ];
    });
    toast.success(`Added ${product.name} to cart`);
  }

  function removeFromCart(index: number) {
    setCart((prev) => prev.filter((_, i) => i !== index));
  }

  function stepQuantity(product: ShopProduct, direction: 1 | -1) {
    const selection = selections[product.id] ?? defaultSelection(product);
    const step = product.unit === 'SQFT' ? 5 : 1;
    const next = Math.max(product.minQuantity, (Number(selection.quantity) || product.minQuantity) + direction * step);
    updateSelection(product.id, { quantity: next });
  }

  const subtotal = round2(cart.reduce((sum, item) => sum + item.lineTotal, 0));
  const taxAmount = round2(subtotal * (taxRatePercent / 100));
  const total = round2(subtotal + taxAmount);

  async function handleCheckout() {
    if (cart.length === 0) return;
    setCheckingOut(true);
    try {
      const res = await fetch('/api/shop/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            selectedOptions: item.selectedOptions,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error ?? 'Checkout failed');
      window.location.href = data.url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Checkout failed. Please try again.');
      setCheckingOut(false);
    }
  }

  return (
    <div className="portal-card shop-section" style={{ marginBottom: '1.5rem' }}>
      <div className="portal-card-header">
        <h2>Order Materials &amp; Extras</h2>
        <Link href="/mypage/orders" className="portal-card-link">
          Order history
        </Link>
      </div>

      <div className="shop-tabs">
        <button
          className={`shop-tab ${category === 'MATERIAL' ? 'is-active' : ''}`}
          onClick={() => setCategory('MATERIAL')}
        >
          Flooring Materials
        </button>
        <button
          className={`shop-tab ${category === 'ACCESSORY' ? 'is-active' : ''}`}
          onClick={() => setCategory('ACCESSORY')}
        >
          Accessories &amp; Care
        </button>
      </div>

      <div className="shop-carousel">
        <button
          type="button"
          className="shop-carousel-arrow shop-carousel-arrow-prev"
          onClick={() => scrollTrack(productTrackRef, -1)}
          aria-label="Scroll left"
        >
          ‹
        </button>
        <div className="shop-carousel-track" ref={productTrackRef}>
          {visibleProducts.map((product) => {
            const selection = selections[product.id] ?? defaultSelection(product);
            const unitPrice = computeUnitPrice(product, selection.selectedOptions);
            return (
              <div key={product.id} className="shop-card">
                <div className="shop-card-image-wrap">
                  {SHOW_PRODUCT_IMAGES && product.image ? (
                    <Image
                      src={product.image.src}
                      alt={product.name}
                      fill
                      sizes={IMG_SIZES.shopCard}
                      placeholder="blur"
                      blurDataURL={BLUR_WARM}
                      className="shop-card-image"
                    />
                  ) : (
                    <div className="shop-card-image shop-card-image-fallback" />
                  )}
                </div>

                <div className="shop-card-body">
                  <div className="shop-card-head">
                    <div className="shop-card-name">{product.name}</div>
                    {(product.species || product.format) && (
                      <div className="shop-card-meta">
                        {[product.species, product.format].filter(Boolean).join(' · ')}
                        {product.janka ? ` · Janka ${product.janka}` : ''}
                      </div>
                    )}
                    {product.description && <p className="shop-card-desc">{product.description}</p>}
                  </div>

                  <div className="shop-price">
                    {formatCAD(unitPrice)}
                    <span className="shop-price-unit"> / {unitLabel(product.unit)}</span>
                  </div>

                  {product.options.map((group) => (
                    <label key={group.name} className="shop-field">
                      <span>{group.name}</span>
                      <select
                        className="shop-select"
                        value={selection.selectedOptions[group.name] ?? group.choices[0]?.label}
                        onChange={(e) =>
                          updateSelection(product.id, {
                            selectedOptions: { ...selection.selectedOptions, [group.name]: e.target.value },
                          })
                        }
                      >
                        {group.choices.map((choice) => (
                          <option key={choice.label} value={choice.label}>
                            {choice.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}

                  <label className="shop-field">
                    <span>Quantity ({unitLabel(product.unit)})</span>
                    <div className="shop-qty-stepper">
                      <button
                        type="button"
                        aria-label="Decrease quantity"
                        onClick={() => stepQuantity(product, -1)}
                      >
                        −
                      </button>
                      <input
                        type="number"
                        className="shop-input"
                        min={product.minQuantity}
                        step={product.unit === 'SQFT' ? 5 : 1}
                        value={selection.quantity}
                        onChange={(e) => updateSelection(product.id, { quantity: Number(e.target.value) })}
                      />
                      <button
                        type="button"
                        aria-label="Increase quantity"
                        onClick={() => stepQuantity(product, 1)}
                      >
                        +
                      </button>
                    </div>
                  </label>

                  <button className="btn btn-copper btn-sm shop-add-btn" onClick={() => addToCart(product)}>
                    Add to cart
                  </button>

                  {SHOW_PRODUCT_IMAGES && product.category === 'ACCESSORY' && product.image?.credit && (
                    <a
                      href={product.image.creditUrl ?? undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shop-card-credit"
                    >
                      Photo: {product.image.credit} / Unsplash
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <button
          type="button"
          className="shop-carousel-arrow shop-carousel-arrow-next"
          onClick={() => scrollTrack(productTrackRef, 1)}
          aria-label="Scroll right"
        >
          ›
        </button>
      </div>

      <div className="shop-cart">
        <h3 className="shop-cart-title">Your cart</h3>
        {cart.length === 0 ? (
          <p className="portal-empty">Nothing added yet — browse materials or accessories above.</p>
        ) : (
          <>
            <div className="shop-carousel shop-cart-carousel">
              <button
                type="button"
                className="shop-carousel-arrow shop-carousel-arrow-prev"
                onClick={() => scrollTrack(cartTrackRef, -1)}
                aria-label="Scroll left"
              >
                ‹
              </button>
              <div className="shop-cart-items" ref={cartTrackRef}>
                {cart.map((item, i) => (
                  <div key={i} className="shop-cart-item">
                    <div className="shop-cart-item-top">
                      <div className="shop-cart-item-thumb">
                        {SHOW_PRODUCT_IMAGES && item.image && (
                          <Image
                            src={item.image.src}
                            alt={item.name}
                            fill
                            sizes="44px"
                            placeholder="blur"
                            blurDataURL={BLUR_WARM}
                          />
                        )}
                      </div>
                      <div className="shop-cart-item-info">
                        <div className="shop-cart-item-name">{item.name}</div>
                        <div className="shop-cart-item-meta">
                          {item.quantity} {unitLabel(item.unit)} × {formatCAD(item.unitPrice)}
                          {Object.values(item.selectedOptions).some(Boolean) && (
                            <> · {Object.values(item.selectedOptions).join(', ')}</>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="shop-cart-item-right">
                      <span>{formatCAD(item.lineTotal)}</span>
                      <button className="shop-cart-remove" onClick={() => removeFromCart(i)} aria-label="Remove">
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="shop-carousel-arrow shop-carousel-arrow-next"
                onClick={() => scrollTrack(cartTrackRef, 1)}
                aria-label="Scroll right"
              >
                ›
              </button>
            </div>

            <div className="shop-cart-footer">
              <div className="shop-cart-summary">
                <div className="shop-cart-summary-row">
                  <span>Subtotal</span>
                  <span>{formatCAD(subtotal)}</span>
                </div>
                <div className="shop-cart-summary-row">
                  <span>HST ({taxRatePercent}%)</span>
                  <span>{formatCAD(taxAmount)}</span>
                </div>
                <div className="shop-cart-summary-row shop-cart-summary-total">
                  <span>Total</span>
                  <span>{formatCAD(total)}</span>
                </div>
              </div>

              <button
                className="btn btn-copper btn-lg"
                style={{ width: '100%', marginTop: '0.75rem' }}
                disabled={checkingOut}
                onClick={handleCheckout}
              >
                {checkingOut ? 'Redirecting to Stripe…' : `Checkout — ${formatCAD(total)}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
