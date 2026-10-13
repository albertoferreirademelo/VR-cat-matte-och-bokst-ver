import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

// WebXR needs a secure context. `npm run dev` serves plain http on localhost
// (fine on the PC, or on the headset through `adb reverse`). `npm run dev:quest`
// serves https on the local network so the headset can open it over Wi-Fi.
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: mode === 'quest' ? [basicSsl()] : [],
  server: { host: mode === 'quest', port: 5173 },
}));
