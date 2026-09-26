import { defineConfig } from 'vite';
export default defineConfig({ base: './', build: { target: 'es2022', rolldownOptions: { input: ['index.html','atelier.html'] } } });
