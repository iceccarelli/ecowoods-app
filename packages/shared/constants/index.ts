export const JOB_STATUSES = {
  PENDING: 'pending',
  BIDDING: 'bidding',
  ASSIGNED: 'assigned',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;
 
export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
 
export const ROUTES = {
  HOME: '/',
  JOBS: '/jobs',
  JOB_DETAIL: (id: string) => `/jobs/${id}`,
} as const;
 
/* ---------------------- Social & Review Links (Business Critical - Lead Gen & Social Proof) ---------------------- */
export const SOCIAL_LINKS = [
  { platform: 'Instagram', href: 'https://www.instagram.com/ecowoods.ca', label: 'Instagram' },
  { platform: 'Facebook', href: 'https://www.facebook.com/ecowoodshardwood', label: 'Facebook' },
  { platform: 'Houzz', href: 'https://www.houzz.com/pro/ecowoods', label: 'Houzz' },
  { platform: 'Google', href: 'https://www.google.com/maps?cid=ecowoods', label: 'Google Reviews' },
  { platform: 'LinkedIn', href: 'https://www.linkedin.com/company/ecowoods-hardwood-flooring', label: 'LinkedIn' },
  { platform: 'YouTube', href: 'https://www.youtube.com/@ecowoods', label: 'YouTube' },
  { platform: 'TikTok', href: 'https://www.tiktok.com/@ecowoods.hardwood', label: 'TikTok' },
  { platform: 'Pinterest', href: 'https://www.pinterest.com/ecowoods', label: 'Pinterest' },
  { platform: 'X', href: 'https://x.com/ecowoods', label: 'X' },
  { platform: 'WhatsApp', href: 'https://wa.me/14162491276?text=Hi%20Ecowoods%2C%20I%27d%20like%20a%20free%20estimate%20for%20hardwood%20flooring', label: 'WhatsApp' },
  { platform: 'Website', href: 'https://ecowoods.ca', label: 'Official Website' },
  { platform: 'Telegram', href: 'https://t.me/ecowoods', label: 'Telegram' },
] as const;
 
export type SocialLink = (typeof SOCIAL_LINKS)[number];
 
