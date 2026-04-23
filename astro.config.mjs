// @ts-check
import react from '@astrojs/react';
import vercel from '@astrojs/vercel';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  integrations: [react()],
  adapter: vercel(),
  output: 'server',
  vite: {
    // @ts-ignore - Vite version mismatch between Astro and Tailwind
    plugins: [tailwindcss()],
  },
});
