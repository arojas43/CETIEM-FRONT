/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // CETIEM brand palette
        cetiem: {
          green:   "#00D47A",
          greenDim: "rgba(0,212,122,0.12)",
          lime:    "#ADFF4F",
          cyan:    "#00C8E0",
          dark:    "#0A0A0A",
          surface: "#111111",
          surface2: "#161616",
        },
        // Keep backward-compat alias for shared components
        economia: {
          success: "#00D47A",
          danger:  "#EF4444",
          warning: "#FBBF24",
          info:    "#00C8E0",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "'Inter'", "system-ui", "sans-serif"],
        heading: ["var(--font-inter)", "'Inter'", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "'Fira Code'", "monospace"],
      },
      boxShadow: {
        'glow-green': '0 0 20px rgba(0,212,122,0.25), 0 0 60px rgba(0,212,122,0.08)',
        'glow-green-sm': '0 0 10px rgba(0,212,122,0.20)',
        'glow-cyan': '0 0 20px rgba(0,200,224,0.25)',
        'glass': '0 8px 32px rgba(0,0,0,0.4)',
        'gob': '0 4px 24px rgba(0,0,0,0.4)',
      },
      backgroundImage: {
        'cetiem-gradient': 'linear-gradient(135deg, rgba(0,212,122,0.15) 0%, rgba(0,200,224,0.08) 50%, rgba(173,255,79,0.05) 100%)',
        'cetiem-glow': 'radial-gradient(ellipse at 50% 0%, rgba(0,212,122,0.15) 0%, transparent 60%)',
      },
      animation: {
        'pulse-green': 'pulse-green 2s cubic-bezier(0.4,0,0.6,1) infinite',
      },
      keyframes: {
        'pulse-green': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
      },
    },
  },
  plugins: [],
}
