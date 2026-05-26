import type { Config } from 'tailwindcss';
const config: Config = { content: ['./app/**/*.{js,jsx,ts,tsx}', '../../packages/ui/src/**/*.{js,jsx,ts,tsx}'], theme: { extend: { colors: { primary: '#0A3D2E', accent: '#C5A26F' } } }, plugins: [] };
export default config;
