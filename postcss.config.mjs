/** @type {import('postcss-load-config').Config} */
// Tailwind v4: @tailwindcss/postcss sudah menangani prefixing —
// autoprefixer terpisah tidak lagi dibutuhkan (dihapus dari dependencies).
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};

export default config;
