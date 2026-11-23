/**
 * Prevent a local Vite build/offline-shell job from overwriting a HYPRBOX
 * authenticated private gateway's active static directory.
 *
 * No credentials are read or logged. The only setting inspected is pwaDist.
 * CI and ordinary devices without an installed gateway remain unaffected.
 */
import {existsSync,readFileSync} from 'node:fs';
import {isAbsolute,join,resolve,sep} from 'node:path';

function normal(s){
  // path.resolve removes trailing separators without harming volume roots.
  const normalized=resolve(s);
  return process.platform==='win32'?normalized.toLowerCase():normalized;
}
export function pathsOverlap(a,b){
  const left=normal(a),right=normal(b);
  return left===right||left.startsWith(right+sep)||right.startsWith(left+sep);
}
export function protectDeployedPwaDist(output,{
  settingsPath=(process.env.LOCALAPPDATA?
    join(process.env.LOCALAPPDATA,'MarketCompass','PrivateAI','gateway-settings.json'):null)
}={}){
  if(!settingsPath||!existsSync(settingsPath))return;
  let settings;
  try{settings=JSON.parse(readFileSync(settingsPath,'utf8').replace(/^\uFEFF/,''))}
  catch{throw Error('RELEASE-SAFETY BLOCK: gateway config unreadable; refusing local build')}
  const deployed=settings?.pwaDist;
  if(typeof deployed!=='string'||!isAbsolute(deployed))
    throw Error('RELEASE-SAFETY BLOCK: configured private PWA directory invalid');
  if(pathsOverlap(output,deployed))
    throw Error('RELEASE-SAFETY BLOCK: build output overlaps the active private PWA directory. Set MC_PWA_OUT_DIR to a new, separate release-candidate path instead.');
}
