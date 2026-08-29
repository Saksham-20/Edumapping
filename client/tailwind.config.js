// client/tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Existing app palette (dashboards, forms) — unchanged.
        primary: {
          50: '#e6f2f8',
          100: '#b3d9e8',
          200: '#80c0d8',
          300: '#4da7c8',
          400: '#1a8eb8',
          500: '#156395',
          600: '#175f92',
          700: '#124a75',
          800: '#0e3658',
          900: '#0a223b',
        },
        secondary: {
          50: '#f0f9ed',
          100: '#d4f0c4',
          200: '#b8e79b',
          300: '#9cde72',
          400: '#80d549',
          500: '#56b234',
          600: '#44902a',
          700: '#336e20',
          800: '#224c16',
          900: '#112a0c',
        },

        // ------------------------------------------------ landing brand system
        // Near-black ink. Used for type on the light canvas and as the ground
        // for the inverted bands. Also consumed by the conference UI.
        ink: {
          950: '#0B0C0E',
          900: '#131519',
          850: '#1A1D23',
          800: '#22262E',
          700: '#31363F',
          600: '#4A505B',
          // 5.3:1 on bone-100, 6.0:1 on white — the muted label grey has to
          // clear AA on every ground the landing page uses it against.
          500: '#5D646E',
        },
        // Bone — the warm off-white canvas the whole page sits on. Warmer than
        // slate-50, which reads grey and clinical next to the saffron accent.
        bone: {
          50: '#FBFAF7',
          100: '#F5F2EA',
          200: '#EBE6D9',
          300: '#DBD4C2',
          400: '#B9AF99',
        },
        // Saffron — the single hot accent. 500 is the brand value.
        saffron: {
          50: '#FFF6EC',
          100: '#FFE8CE',
          200: '#FFD1A0',
          300: '#FFB871',
          400: '#FFA451',
          500: '#FF9933',
          600: '#E77E1B',
          700: '#B85F11',
          800: '#8A460D',
          900: '#5C2E08',
        },
        // India green — secondary accent, and the "positive/verified" colour.
        india: {
          50: '#EDFBEB',
          100: '#D0F5CA',
          200: '#A2E997',
          300: '#6FD960',
          400: '#3FC42D',
          500: '#22A814',
          600: '#138808',
          700: '#0F6C06',
          800: '#0B5005',
          900: '#073503',
        },
        azure: {
          400: '#2E8FC4',
          500: '#1E7AAD',
          600: '#156395',
          700: '#0F4C74',
        },
      },
      fontFamily: {
        // Body: Plus Jakarta Sans — humanist, high x-height, reads well small.
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        // Display: Space Grotesk — distinctive, slightly technical letterforms.
        // Carries the oversized editorial headlines without feeling corporate.
        display: ['"Space Grotesk"', '"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        mono: ['"Space Grotesk"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        // Fluid editorial scale. Every headline on the landing page uses one of
        // these, so type never drifts between sections.
        'display-xs': ['clamp(1.6rem, 1.2rem + 1.6vw, 2.1rem)', { lineHeight: '1.15', letterSpacing: '-0.02em' }],
        'display-sm': ['clamp(2rem, 1.3rem + 3vw, 3rem)', { lineHeight: '1.08', letterSpacing: '-0.03em' }],
        'display': ['clamp(2.6rem, 1.4rem + 5.2vw, 4.75rem)', { lineHeight: '1.02', letterSpacing: '-0.035em' }],
        'display-lg': ['clamp(3rem, 1.1rem + 8vw, 6.5rem)', { lineHeight: '0.96', letterSpacing: '-0.04em' }],
        'display-xl': ['clamp(3.4rem, 0.6rem + 11vw, 9rem)', { lineHeight: '0.92', letterSpacing: '-0.045em' }],
      },
      maxWidth: {
        content: '1240px',
        prose: '64ch',
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.75rem',
      },
      boxShadow: {
        // Editorial offset shadow — a hard block, not a soft blur. Used only on
        // the primary CTA and the hero preview so it stays a deliberate accent.
        'block': '4px 4px 0 0 #0B0C0E',
        'block-sm': '3px 3px 0 0 #0B0C0E',
        'block-saffron': '4px 4px 0 0 #FF9933',
        'lift': '0 1px 2px rgba(11,12,14,.04), 0 8px 24px -12px rgba(11,12,14,.16)',
        'lift-lg': '0 2px 4px rgba(11,12,14,.05), 0 28px 56px -28px rgba(11,12,14,.3)',
      },
      backgroundImage: {
        'tricolor': 'linear-gradient(90deg, #FF9933 0%, #FFFFFF 50%, #138808 100%)',
        'tricolor-warm': 'linear-gradient(120deg, #FF9933 0%, #FFB871 40%, #3FC42D 75%, #138808 100%)',
        'grid-dark': 'linear-gradient(rgba(255,255,255,.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.04) 1px, transparent 1px)',
        'grid-light': 'linear-gradient(rgba(11,12,14,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(11,12,14,.05) 1px, transparent 1px)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'marquee': 'marquee 42s linear infinite',
        'marquee-slow': 'marquee 68s linear infinite',
        'float': 'float 7s ease-in-out infinite',
        'sheen': 'sheen 3.2s ease-in-out infinite',
        'pulse-dot': 'pulseDot 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        float: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        sheen: {
          '0%': { transform: 'translateX(-130%)' },
          '55%,100%': { transform: 'translateX(240%)' },
        },
        pulseDot: {
          '0%,100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '.45', transform: 'scale(.85)' },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}
