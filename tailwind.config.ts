import type { Config } from "tailwindcss";

/** Design tokens de Cerca — ver plan MVP §8 */
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: "#3D6D92", soft: "#E8F0F6", dark: "#3A6689" },
        accent: "#F07860", mint: { DEFAULT: "#8FD7BF", soft: "#EAF7F2" },
        success: { DEFAULT: "#3E7C4F", soft: "#E9F3EC" },
        warning: { DEFAULT: "#805510", soft: "#FBF3E4" },
        danger: "#A94442",
        background: "#F7FAFB",
        surface: "#FFFFFF",
        ink: { DEFAULT: "#1F2933", secondary: "#52606D" },
        line: "#E4E0DA"
      },
      borderRadius: { md: "12px", lg: "16px", xl: "20px" },
      fontFamily: { sans: ["'Inter Variable'", "system-ui", "sans-serif"] },
      minHeight: { touch: "48px", cta: "56px" }
    }
  },
  plugins: []
} satisfies Config;
