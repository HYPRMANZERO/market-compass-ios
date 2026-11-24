import path from 'path';
import { readFileSync, writeFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type Plugin } from 'vite';
import { protectDeployedPwaDist } from '../../scripts/protect-gateway-dist.mjs';


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
const edition = process.env.VITE_MC_EDITION || 'personal';
if (edition !== 'personal' && edition !== 'finance') throw Error('VITE_MC_EDITION must be personal or finance.');
const brandEdition:Plugin = {
  name:'market-compass-edition-branding',
  apply:'build',
  closeBundle(){
    // Explicit static branding, separate from the authenticated gateway's authority.
    if(edition!=='finance')return;
    const manifestPath=path.join(outDir,'manifest.webmanifest');
    const manifest=JSON.parse(readFileSync(manifestPath,'utf8'));
    manifest.name='Compass Financial Advisor';
    manifest.short_name='Finance';
    manifest.description='Private finance-focused assistant and financial workspace.';
    writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');
    const indexPath=path.join(outDir,'index.html');
    let html=readFileSync(indexPath,'utf8');
    html=html.replace(/<title>[^<]*<\/title>/,'<title>Compass Financial Advisor</title>')
      .replace(/(<meta name="apple-mobile-web-app-title" content=")[^"]*(")/,'$1Compass Financial Advisor$2');
    writeFileSync(indexPath,html);
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
