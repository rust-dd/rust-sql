/** @type {import('tailwindcss').Config} */
module.exports = {
  content: {
    files: ["*.html", "./src/**/*.rs"],
  },
  theme: {
    extend: {
      borderWidth: {
        1: "1px",
      },
    },
  },
  plugins: [],
};
