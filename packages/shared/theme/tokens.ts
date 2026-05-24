export const colors = {
  primary: '#0A3D2E',
  walnut: { 50: '#F8F1E9', 100: '#F0E4D3', 500: '#5C4033', 600: '#4A3228', 900: '#2C2118' },
  oak: { 400: '#C4A484', 500: '#8B6F47', 600: '#6B5335' },
  cream: { 50: '#FDF8F0', 100: '#F5EDE0', 200: '#EDE4D4' },
  copper: '#B87333',
  forest: '#0A3D2E',
  success: '#22C173',
  error: '#EF4444',
  muted: '#6B7280',
} as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, '2xl': 48, '3xl': 64 } as const;
export const radius = { sm: 6, md: 12, lg: 16, xl: 24, full: 9999 } as const;

export const typography = {
  fontFamily: {
    sans: 'var(--font-body)',
    display: 'var(--font-display)',
    mono: 'var(--font-mono)',
  },
} as const;
