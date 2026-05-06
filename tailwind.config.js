/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  // important:true hace que todas las utilidades Tailwind usen !important
  // → necesario para ganar sobre Bootstrap 5 que carga el CDN de GobMX
  important: true,
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
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
        // Paleta oficial Identidad Gobierno de México 2024-2030 (v3)
        // Referencia: https://www.gob.mx/guias/grafica/v3/
        economia: {
          guinda: "#9D2449",  // Color primario institucional
          guindaDark: "#6F102D",  // Variante oscura para hover
          dorado: "#BC955C",  // Color secundario institucional
          doradoLight: "#DDC9A3",  // Variante clara
          verde: "#12322B",  // Verde institucional oscuro
          verdeLight: "#1E5B4F",  // Verde institucional medio
          gris: "#98989A",  // Gris institucional
          texto: "#545454",  // Gris para cuerpo de texto (v3)
          blanco: "#FFFFFF",  // Blanco puro

          // Semántica para el proyecto
          success: "#1E5B4F",  // Verde medio
          info: "#12322B",  // Verde oscuro
          warning: "#BC955C",  // Dorado
          danger: "#9D2449",  // Guinda
          error: "#9D2449",   // Alias de danger (errores, rechazos, fallidos)
          verdeDark: "#0B1A18", // Verde muy oscuro — paneles/sidebars oscuros
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["var(--font-noto)", "'Noto Sans'", "system-ui", "sans-serif"],
        heading: ["'Patria'", "var(--font-playfair)", "'Playfair Display'", "serif"],
      },
      lineHeight: {
        'gob': '1.428', // Estandarizado gob.mx v3
      },
      fontSize: {
        'gob-body': '18px', // Estandarizado gob.mx v3
      }
    },
  },
  plugins: [],
}
