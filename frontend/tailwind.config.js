import animate from "tailwindcss-animate";
import plugin from "tailwindcss/plugin";

export default {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
    "./app/**/*.{js,jsx}",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      colors: {
        border: "var(--color-border)",
        input: "var(--color-input)",
        ring: "var(--color-ring)",
        background: "var(--color-background)",
        foreground: "var(--color-foreground)",
        surface: "var(--color-surface)",
        primary: {
          50: "var(--color-primary-50)",
          100: "var(--color-primary-100)",
          200: "var(--color-primary-200)",
          300: "var(--color-primary-300)",
          400: "var(--color-primary-400)",
          500: "var(--color-primary-500)",
          600: "var(--color-primary-600)",
          700: "var(--color-primary-700)",
          800: "var(--color-primary-800)",
          900: "var(--color-primary-900)",
          DEFAULT: "var(--color-primary)",
          foreground: "var(--color-primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--color-secondary)",
          foreground: "var(--color-secondary-foreground)",
        },
        accent: {
          DEFAULT: "var(--color-accent)",
          foreground: "var(--color-accent-foreground)",
        },
        destructive: {
          DEFAULT: "var(--color-error)",
          foreground: "var(--color-error-foreground)",
        },
        muted: {
          DEFAULT: "var(--color-muted)",
          foreground: "var(--color-muted-foreground)",
        },
        popover: {
          DEFAULT: "var(--color-popover)",
          foreground: "var(--color-popover-foreground)",
        },
        card: {
          DEFAULT: "var(--color-card)",
          foreground: "var(--color-card-foreground)",
        },
        success: {
          DEFAULT: "var(--color-success)",
          foreground: "var(--color-success-foreground)",
        },
        warning: {
          DEFAULT: "var(--color-warning)",
          foreground: "var(--color-warning-foreground)",
        },
        error: {
          DEFAULT: "var(--color-error)",
          foreground: "var(--color-error-foreground)",
        },
        "text-primary": "var(--color-text-primary)",
        "text-secondary": "var(--color-text-secondary)",
        neon: {
          cyan: "var(--neon-cyan)",
          blue: "var(--neon-blue)",
          violet: "var(--neon-violet)",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      borderRadius: {
        xl: "calc(var(--radius) + 4px)",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        card: "var(--shadow-card)",
        modal: "var(--shadow-pop)",
        glow: "0 0 0 2px color-mix(in srgb, var(--color-ring) 40%, transparent), 0 0 24px -4px var(--color-ring)",
        "inner-top": "inset 0 1px 0 rgba(255,255,255,.06)",
      },
      backdropBlur: {
        glass: "var(--glass-blur)",
      },
      gradientColorStops: {
        "brand-from": "var(--grad-from)",
        "brand-via": "var(--grad-via)",
        "brand-to": "var(--grad-to)",
      },
      keyframes: {
        "accordion-down": { from: { height: "0" }, to: { height: "var(--radix-accordion-content-height)" } },
        "accordion-up": { from: { height: "var(--radix-accordion-content-height)" }, to: { height: "0" } },
        shimmer: { "0%": { transform: "translateX(-100%)" }, "100%": { transform: "translateX(100%)" } },
        glow: {
          "0%,100%": { boxShadow: "0 0 0 0 rgba(125,211,252,.35)" },
          "50%": { boxShadow: "0 0 0 6px rgba(125,211,252,.12)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        shimmer: "shimmer 1.5s infinite",
        glow: "glow 2.6s ease-in-out infinite",
      },
      spacing: {
        18: "4.5rem",
        88: "22rem",
        280: "70rem",
      },
      zIndex: { 90: "90", 100: "100", 110: "110" },
      transitionTimingFunction: { "in-out": "ease-in-out", out: "ease-out" },
    },
  },
  plugins: [
    animate,
    plugin(({ addUtilities, addVariant, theme }) => {
      addVariant("hocus", ["&:hover", "&:focus"]);
      addUtilities({
        ".text-shadow-sm": { textShadow: "0 1px 1px rgba(0,0,0,.25)" },
        ".text-shadow": { textShadow: "0 2px 6px rgba(0,0,0,.35)" },
        ".ring-brand": {
          boxShadow: `0 0 0 2px ${theme("colors.ring")}, 0 0 0 4px color-mix(in srgb, var(--color-ring) 45%, transparent)`,
        },
        ".glass-border": { border: "1px solid var(--color-border)" },
      });
    }),
  ],
};