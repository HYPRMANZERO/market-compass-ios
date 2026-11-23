/** Builds an isolated, root-based Capacitor web bundle.
 * Does not touch the private authenticated gateway's active PWA files. */
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const app=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(import.meta.url);
const vite=path.join(path.dirname(require.resolve('vite/package.json')),'bin','vite.js');
const env={
  ...process.env,
  BASE_PATH:'/',
  MC_PWA_OUT_DIR:path.join(app,'dist','native')
};
const result=spawnSync(process.execPath,[vite,'build','--config','vite.config.ts'],{
  cwd:app,env,stdio:'inherit',windowsHide:true
});
if(result.error)throw result.error;
if(result.status!==0)process.exit(result.status??1);
console.log('CAPACITOR WEB BUILD READY: '+env.MC_PWA_OUT_DIR);
