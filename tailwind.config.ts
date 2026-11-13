import type { Config } from 'tailwindcss';
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#0F6E56', hover: '#0C5A47', soft: '#E7F3EF' },
        accent: { DEFAULT: '#C2681C', soft: '#FDF0E2' },
        ink: { DEFAULT: '#16242B', 2: '#4A5A60', 3: '#7A8A90' },
        line: '#E2E9EB',
        canvas: '#F3F6F7',
        danger: { DEFAULT: '#B42318', soft: '#FEF3F2' },
        warn: { DEFAULT: '#8A5A06', soft: '#FEF6E7' },
      },
      borderRadius: { card: '14px', control: '10px', input: '9px' },
      fontFamily: { sans: ['system-ui', '"Microsoft YaHei"', 'sans-serif'] },
    },
  },
  plugins: [],
} satisfies Config;
