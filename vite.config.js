import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // VITE_ (로컬 .env) 와 ANTHROPIC_ (Vercel 환경변수) 둘 다 노출
  envPrefix: ['VITE_', 'ANTHROPIC_'],
})
