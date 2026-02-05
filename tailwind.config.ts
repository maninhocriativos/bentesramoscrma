import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: {
        "2xl": "1600px",
      },
    },
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Poppins', 'sans-serif'],
      },
      fontSize: {
        'xs': ['12px', '16px'],
        'sm': ['13px', '18px'],
        'base': ['14px', '20px'],
        'lg': ['16px', '24px'],
        'xl': ['18px', '28px'],
        '2xl': ['22px', '30px'],
        '3xl': ['28px', '36px'],
      },
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
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        gold: {
          DEFAULT: "hsl(var(--gold))",
          foreground: "hsl(var(--gold-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        // Pipeline Stages
        stage: {
          all: "hsl(var(--stage-all))",
          "all-bg": "hsl(var(--stage-all-bg))",
          frio: "hsl(var(--stage-frio))",
          "frio-bg": "hsl(var(--stage-frio-bg))",
          bentes: "hsl(var(--stage-bentes))",
          "bentes-bg": "hsl(var(--stage-bentes-bg))",
          atendimento: "hsl(var(--stage-atendimento))",
          "atendimento-bg": "hsl(var(--stage-atendimento-bg))",
          negociacao: "hsl(var(--stage-negociacao))",
          "negociacao-bg": "hsl(var(--stage-negociacao-bg))",
          aguardando: "hsl(var(--stage-aguardando))",
          "aguardando-bg": "hsl(var(--stage-aguardando-bg))",
          assinado: "hsl(var(--stage-assinado))",
          "assinado-bg": "hsl(var(--stage-assinado-bg))",
          ganho: "hsl(var(--stage-ganho))",
          "ganho-bg": "hsl(var(--stage-ganho-bg))",
          perdido: "hsl(var(--stage-perdido))",
          "perdido-bg": "hsl(var(--stage-perdido-bg))",
        },
        // Linha WhatsApp
        linha: {
          escritorio: "hsl(var(--linha-escritorio))",
          "escritorio-bg": "hsl(var(--linha-escritorio-bg))",
          trafego: "hsl(var(--linha-trafego))",
          "trafego-bg": "hsl(var(--linha-trafego-bg))",
        },
        // Origem
        origem: {
          ads: "hsl(var(--origem-ads))",
          "ads-bg": "hsl(var(--origem-ads-bg))",
          site: "hsl(var(--origem-site))",
          "site-bg": "hsl(var(--origem-site-bg))",
          organico: "hsl(var(--origem-organico))",
          "organico-bg": "hsl(var(--origem-organico-bg))",
        },
        // Action Icons
        action: {
          chat: "hsl(var(--action-chat))",
          "chat-bg": "hsl(var(--action-chat-bg))",
          view: "hsl(var(--action-view))",
          "view-bg": "hsl(var(--action-view-bg))",
          menu: "hsl(var(--action-menu))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "0.875rem",
        "2xl": "1.25rem",
      },
      boxShadow: {
        'soft': '0 2px 8px -2px hsla(24, 21%, 21%, 0.06)',
        'soft-lg': '0 4px 16px -4px hsla(24, 21%, 21%, 0.1)',
        'enterprise': '0 1px 2px hsla(24, 21%, 21%, 0.03), 0 2px 8px hsla(24, 21%, 21%, 0.05), 0 4px 16px hsla(24, 21%, 21%, 0.06)',
        'card-hover': '0 4px 12px hsla(24, 21%, 21%, 0.08), 0 8px 24px hsla(24, 21%, 21%, 0.1)',
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in": {
          from: { transform: "translateX(-100%)" },
          to: { transform: "translateX(0)" },
        },
        "slide-in-right": {
          from: { transform: "translateX(100%)", opacity: "0" },
          to: { transform: "translateX(0)", opacity: "1" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.97)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "bounce-in": {
          "0%": { transform: "scale(0.3)", opacity: "0" },
          "50%": { transform: "scale(1.05)" },
          "70%": { transform: "scale(0.9)" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "pulse-subtle": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.7" },
        },
        "float": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
        "shimmer": {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "glow": {
          "0%, 100%": { boxShadow: "0 0 5px hsl(var(--gold) / 0.3)" },
          "50%": { boxShadow: "0 0 20px hsl(var(--gold) / 0.6)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.3s ease-out forwards",
        "fade-in-up": "fade-in-up 0.4s ease-out forwards",
        "slide-in": "slide-in 0.25s ease-out",
        "slide-in-right": "slide-in-right 0.3s ease-out",
        "scale-in": "scale-in 0.2s ease-out",
        "bounce-in": "bounce-in 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)",
        "pulse-subtle": "pulse-subtle 2s ease-in-out infinite",
        "float": "float 3s ease-in-out infinite",
        "shimmer": "shimmer 2s linear infinite",
        "glow": "glow 2s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
