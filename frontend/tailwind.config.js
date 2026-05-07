/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        starlight: ({ opacityValue }) =>
          opacityValue !== undefined
            ? `hsl(72 100% 70% / ${opacityValue})`
            : "hsl(72 100% 70%)",
        "nebula-blue": ({ opacityValue }) =>
          opacityValue !== undefined
            ? `hsl(220 80% 60% / ${opacityValue})`
            : "hsl(220 80% 60%)",
        void: ({ opacityValue }) =>
          opacityValue !== undefined
            ? `hsl(240 20% 4% / ${opacityValue})`
            : "hsl(240 20% 4%)",
      },
      animation: {
        drift: "drift 18s ease-in-out infinite",
        "fade-in": "fade-in 0.5s ease-out",
        "scale-in": "scale-in 0.3s ease-out",
      },
      keyframes: {
        drift: {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "33%": { transform: "translate(30px, -20px) scale(1.05)" },
          "66%": { transform: "translate(-20px, 10px) scale(0.95)" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.95)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
      },
      boxShadow: {
        glow: "0 0 40px hsla(72, 100%, 70%, 0.4)",
      },
    },
  },
  plugins: [],
};
