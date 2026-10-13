/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        minecraft: {
          grass: '#90EE90',
          dirt: '#8B4513',
          stone: '#808080',
          diamond: '#33EBFF',
          gold: '#FFD700',
          wood: '#8B4513',
        },
      },
      fontFamily: {
        minecraft: ['Minecraft', 'monospace'],
      },
    },
  },
  plugins: [],
};
