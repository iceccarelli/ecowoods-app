import type { Product } from '@ecowoods/types';
const BASE = process.env.EXPO_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const API = `${BASE}/api/v1`;
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers||{}) } });
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  return res.status === 204 ? (undefined as T) : res.json();
}
export const api = {
  getProducts: () => request<Product[]>('/products/'),
  getProduct: (id: number) => request<Product>(`/products/${id}`),
};
export { BASE as API_BASE_URL };
