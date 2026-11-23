import type {CapacitorConfig} from '@capacitor/cli';

/** Store-ready wrapper configuration. Native vaults are deliberately isolated
 * from browser PWA vaults; users must explicitly restore an encrypted backup.
 * Never configure a remote server.url or package gateway/Ollama secrets. */
const config:CapacitorConfig={
  appId:'com.hyprmanzero.marketcompass',
  appName:'Market Compass',
  webDir:'dist/native',
  server:{androidScheme:'https'}
};
export default config;
