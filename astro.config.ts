import react from '@astrojs/react';
import vercel from '@astrojs/vercel';
import tailwindcss from '@tailwindcss/vite';
import auth from 'auth-astro';
import { defineConfig } from 'astro/config';

export default defineConfig({
  integrations: [react(), auth()],
  adapter: vercel(),
  output: 'server',
  vite: {
    // @ts-ignore - Vite version mismatch between Astro and Tailwind
    plugins: [tailwindcss()],
  },
});
