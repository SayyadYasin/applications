import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: { extend: { colors: { brand: '#ea580c' } } },
} satisfies Config;
