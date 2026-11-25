import path from 'path';
import {readFileSync,writeFileSync} from 'node:fs';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type Plugin } from 'vite';
import { protectDeployedPwaDist } from '../../scripts/protect-gateway-dist.mjs';

import runtimeErrorOverlay from '@replit/vite-plugin-runtime-error-modal';

const rawPort = process.env.PORT || "5173";

if (!rawPort) {
  throw new Error(
    'PORT environment variable is required but was not provided.',
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const outDir = path.resolve(process.env.MC_PWA_OUT_DIR || path.resolve(import.meta.dirname, 'dist/public'));
const edition=process.env.VITE_MC_EDITION||'personal';
if(edition!=='finance'&&edition!=='personal')throw Error('Invalid Compass build edition.');
const brandEdition:Plugin={
  name:'market-compass-edition-branding',
  apply:'build',
  closeBundle(){
    if(edition!=='finance')return;
    const file=path.join(outDir,'manifest.webmanifest');
    const manifest=JSON.parse(readFileSync(file,'utf8'));
    manifest.name='Compass Financial Advisor';
    manifest.short_name='Finance';
    manifest.description='Private finance-only advisor and financial workspace.';
    writeFileSync(file,JSON.stringify(manifest,null,2)+'\n');
    const index=path.join(outDir,'index.html');
    let html=readFileSync(index,'utf8');
    html=html.replace(/<title>[^<]*<\/title>/,'<title>Compass Financial Advisor</title>')
      .replace(/(<meta name="apple-mobile-web-app-title" content=")[^"]*(")/,'$1Compass Financial Advisor$2');
    writeFileSync(index,html);
  }
};
const protectLiveGateway:Plugin = {
  name:'market-compass-protect-live-gateway-dist',
  apply:'build',
  // configResolved sees final CLI overrides, before Vite empties build.outDir.
  configResolved(config){ protectDeployedPwaDist(path.resolve(config.root, config.build.outDir)); }
};

const basePath = process.env.BASE_PATH || "/";

if (!basePath) {
  throw new Error(
    'BASE_PATH environment variable is required but was not provided.',
  );
}

export default defineConfig({
  base: basePath,
  plugins: [
    protectLiveGateway,
    brandEdition,
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== 'production' &&
    process.env.REPL_ID !== undefined
      ? [
          await import('@replit/vite-plugin-cartographer').then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, '..'),
            }),
          ),
          await import('@replit/vite-plugin-dev-banner').then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@assets': path.resolve(
        import.meta.dirname,
        '..',
        '..',
        'attached_assets',
      ),
    },
    dedupe: ['react', 'react-dom'],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir,
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(import.meta.dirname,'index.html'),
        ionicPreview: path.resolve(import.meta.dirname,'ionic-preview.html'),
      },
    },
  },
  server: {
    port,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: true,
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: '0.0.0.0',
    allowedHosts: true,
  },
});
