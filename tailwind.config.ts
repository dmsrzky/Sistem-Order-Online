import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1C1614",
        paper: "#FAF8F5",
        line: "#E8E2DA",
        muted: "#8A8078",
        saffron: "#E0A32E",
        lunas: "#1E7A4B",
        belum: "#B27A05",
        gagal: "#B3261E",
      },
      borderRadius: { card: "14px" },
    },
  },
  plugins: [],
};
export default config;
