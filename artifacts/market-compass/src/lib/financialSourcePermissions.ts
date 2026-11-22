/**
 * Permission-bound browser file discovery. A folder picker is a USER gesture,
 * never an unrestricted device scan. Handles, paths, passwords and raw files
 * stay in component memory; no IndexedDB or network access here.
 * iPhone Safari does not provide this picker: use <input multiple> instead.
 */
export type FinanceFileLike=File;
export type FinanceFolderHandle={
  kind:'directory';
  name?:string;
  values:()=>AsyncIterable<FinanceFileHandle|FinanceFolderHandle>;
  queryPermission?:(options:{mode:'read'})=>Promise<'granted'|'denied'|'prompt'>;
};
export type FinanceFileHandle={kind:'file';getFile:()=>Promise<File>};
export const SUPPORT_FILE=/\.(?:pdf|csv|txt|json)$/i;
export const MAX_SCAN_ENTRIES=1000;
export const MAX_SCAN_RESULTS=100;
export const MAX_SCAN_DEPTH=3;
export type FolderScan={files:File[];inspected:number;skipped:number;truncated:boolean};
export function financeFileSignature(file:Pick<File,'name'|'size'|'lastModified'>):string{
  return file.name+'|'+file.size+'|'+file.lastModified;
}
export async function scanGrantedFinanceFolder(
  root:FinanceFolderHandle,
  {maxResults=MAX_SCAN_RESULTS,signal}:{maxResults?:number;signal?:AbortSignal}={}
):Promise<FolderScan>{
  if(root?.kind!=='directory'||typeof root.values!=='function')
    throw Error('Choose a folder using the browser permission dialog.');
  if(typeof root.queryPermission!=='function'||
     await root.queryPermission({mode:'read'})!=='granted')
    throw Error('Folder read permission is not granted. Choose the folder again.');
  const files:File[]=[];let inspected=0,skipped=0,truncated=false;
  const cap=Math.min(MAX_SCAN_RESULTS,Math.max(1,Math.floor(maxResults)));
  const walk=async(dir:FinanceFolderHandle,depth:number):Promise<void>=>{
    for await (const handle of dir.values()){
      if(signal?.aborted)throw Error('Document scan cancelled.');
      if(inspected>=MAX_SCAN_ENTRIES||files.length>=cap){truncated=true;return;}
      inspected++;
      if(handle.kind==='directory'){
        if(depth<MAX_SCAN_DEPTH)await walk(handle,depth+1);
        else skipped++;
      }else if(handle.kind==='file'){
        try{
          const file=await handle.getFile();
          if(SUPPORT_FILE.test(file.name)&&file.size>0&&file.size<=64*1024*1024)
            files.push(file);
          else skipped++;
        }catch{skipped++;}
      }else skipped++;
      if(truncated)return;
    }
  };
  await walk(root,0);
  return {files,inspected,skipped,truncated};
}
export async function pickFinanceFolder():Promise<FinanceFolderHandle>{
  const picker=(window as Window&{
    showDirectoryPicker?:(options:{mode:'read'})=>Promise<FinanceFolderHandle>
  }).showDirectoryPicker;
  if(!picker)throw Error('Folder scanning is unavailable in this browser. Use Select multiple files instead.');
  return picker.call(window,{mode:'read'});
}
