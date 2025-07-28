/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./js/**/*.js",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Century Gothic', 
          'Helvetica', 
          'Arial', 
          'sans-serif'
        ],
      },
    },
  },
  plugins: [],
}
