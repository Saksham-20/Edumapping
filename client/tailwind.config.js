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
          50: '#EEF1F7',
          100: '#D6DCEA',
          200: '#AEB8D2',
          300: '#7F8CB0',
          400: '#55638B',
          500: '#2D3954',
          600: '#1E2A45',
          700: '#17223B',
          800: '#111B31',
          900: '#0C1426',
        },
        secondary: {
          50: '#ECF8EA',
          100: '#D0EFCA',
          200: '#A2DF97',
          300: '#6FCB60',
          400: '#3FB22D',
          500: '#22981A',
          600: '#138808',
          700: '#0F6C06',
          800: '#0B5005',
          900: '#073503',
        },

        // ------------------------------------------------ the attested record
        // Ink: degree-folder navy. Document type, and the ground of the folder
        // surfaces (landing first viewport, app sidebar). Navy rather than
        // black because every Indian certificate is printed and signed in it.
        ink: {
          950: '#0C1426',
          900: '#111B31',
          850: '#17223B',
          800: '#1E2A45',
          700: '#2D3954',
          600: '#46516B',
          // 5.4:1 on paper-100, 6.1:1 on paper-50.
          500: '#56617A',
        },
        // Paper: the security paper a marksheet is printed on.
        bone: {
          50: '#FBF9F4',
          100: '#F5F1E6',
          200: '#EAE3D2',
          300: '#DAD0B8',
          400: '#B6AA8D',
        },
        // Saffron: the tricolour's saffron, the guilloche linework and the one
        // hot accent. Text in saffron uses 700+ for contrast on paper.
        saffron: {
          50: '#FFF6EC',
          100: '#FFE8CE',
          200: '#FFD1A0',
          300: '#FFB871',
          400: '#FFA451',
          500: '#FF9933',
          600: '#E57E14',
          700: '#B35F0C',
          800: '#87470B',
          900: '#5C2E08',
        },
        // India green: verified, cleared, accepted.
        india: {
          50: '#ECF8EA',
          100: '#D0EFCA',
          200: '#A2DF97',
          300: '#6FCB60',
          400: '#3FB22D',
          500: '#22981A',
          600: '#138808',
          700: '#0F6C06',
          800: '#0B5005',
          900: '#073503',
        },
        // Attestation violet: the colour of every Indian office stamp pad.
        // Stamps, locks, information and the signed-off state.
        stamp: {
          50: '#F2F0FA',
          100: '#E3DEF4',
          200: '#C6BDE8',
          300: '#A495D6',
          400: '#7F6CC2',
          500: '#5E48AC',
          600: '#4D3895',
          700: '#3D2C78',
          800: '#2E215B',
          900: '#1F163E',
        },
        // Vermilion: sent back, rejected, revoked. The red of a correction pen.
        vermilion: {
          50: '#FDF0EC',
          100: '#FADDD4',
          200: '#F3B6A5',
          300: '#E98A71',
          400: '#DD6447',
          500: '#C9462A',
          600: '#AE3A21',
          700: '#8E2F1B',
          800: '#6C2415',
          900: '#4A190E',
        },
        azure: {
          400: '#2E8FC4',
          500: '#1E7AAD',
          600: '#156395',
          700: '#0F4C74',
        },
      },
      fontFamily: {
        // Reading and UI: Public Sans, a civic document face.
        sans: ['"Public Sans"', 'system-ui', '-apple-system', '"Segoe UI"', 'sans-serif'],
        // Display and figures: Archivo, set expanded (see index.css) like the
        // denomination on a banknote or the title on a degree certificate.
        display: ['Archivo', '"Public Sans"', 'system-ui', 'sans-serif'],
        // Roll numbers, serials and figures only — never a costume.
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
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
        // Paper resting on a desk: a hairline contact shadow plus a soft fall.
        // The old zero-blur "block" names now resolve to this lift so legacy
        // call sites inherit the new depth instead of a costume.
        'block': '0 1px 1px rgba(12,20,38,.06), 0 12px 28px -16px rgba(12,20,38,.38)',
        'block-sm': '0 1px 1px rgba(12,20,38,.05), 0 8px 18px -12px rgba(12,20,38,.32)',
        'block-saffron': '0 1px 1px rgba(12,20,38,.06), 0 12px 28px -16px rgba(179,95,12,.45)',
        'lift': '0 1px 2px rgba(12,20,38,.05), 0 10px 26px -16px rgba(12,20,38,.28)',
        'lift-lg': '0 2px 4px rgba(12,20,38,.06), 0 30px 60px -30px rgba(12,20,38,.42)',
        'folder': '0 1px 0 rgba(255,255,255,.04) inset, 0 30px 70px -30px rgba(0,0,0,.6)',
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
        'ink-draw': 'inkDraw 2.4s cubic-bezier(.16,1,.3,1) both',
        'stamp-press': 'stampPress .55s cubic-bezier(.16,1,.3,1) both',
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
        inkDraw: {
          '0%': { strokeDashoffset: '1' },
          '100%': { strokeDashoffset: '0' },
        },
        stampPress: {
          '0%': { opacity: '0', transform: 'scale(1.9) rotate(var(--stamp-rot, -7deg))', filter: 'blur(6px)' },
          '60%': { opacity: '1', transform: 'scale(.96) rotate(var(--stamp-rot, -7deg))', filter: 'blur(0)' },
          '100%': { opacity: '1', transform: 'scale(1) rotate(var(--stamp-rot, -7deg))', filter: 'blur(0)' },
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
