/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/renderer/index.html",
    "./src/renderer/src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["'Space Grotesk'", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        serif: ["'Newsreader'", "'Charter'", "'Georgia'", "serif"],
        mono: ['"SF Mono"', '"JetBrains Mono"', "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
}

