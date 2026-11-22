/**
 * Session-only, read-permission folder inventory for compatible desktop browsers.
 * This does NOT read file contents or persist directory handles/paths. The user
 * must explicitly select a folder and separately approve importing each file.
 * Safari/iOS cannot grant filesystem-wide read access or background scanning.
 */
export type ReadableFileEntry={
  kind:'file';name:string;getFile:()=>Promise<File>
};
export type ReadableFolder={
  kind:'directory';name:string;
  values:()=>AsyncIterable<ReadableEntry>;
  queryPermission?:(options:{mode:'read'})=>Promise<'granted'|'prompt'|'denied'>
};
export type ReadableEntry=ReadableFileEntry|ReadableFolder;
export type DiscoveredFinanceFile={file:File;fingerprint:string};
export type FolderScanResult={items:DiscoveredFinanceFile[];truncated:boolean};

const FINANCIAL_FORMAT=/\.(?:pdf|csv|txt|json)$/i;
export const FOLDER_SCAN_MAX_ENTRIES=3000;
export const FOLDER_SCAN_MAX_DEPTH=8;

/**
 * Bounded metadata enumeration keeps the PWA responsive and never opens raw
 * document bytes. "truncated" signals more files may need owner selection.
 */
export async function listConsentedFinanceFiles(root:ReadableFolder):Promise<FolderScanResult>{
  const items:DiscoveredFinanceFile[]=[];
  let examined=0,truncated=false;
  async function visit(dir:ReadableFolder,prefix:string,depth:number):Promise<void>{
    if(depth>FOLDER_SCAN_MAX_DEPTH){truncated=true;return;}
    for await(const entry of dir.values()){
      if(++examined>FOLDER_SCAN_MAX_ENTRIES){truncated=true;return;}
      if(entry.kind==='directory'){
        await visit(entry,prefix+entry.name+'/',depth+1);
      }else if(FINANCIAL_FORMAT.test(entry.name)){
        try{
          const file=await entry.getFile();
          if(file.size>0){
            // Relative filename is a transient in-memory dedupe key only.
            const fingerprint=prefix+entry.name+'|'+file.size+'|'+file.lastModified;
            items.push({file,fingerprint});
          }
        }catch{ /* One inaccessible file must not block the remaining folder. */ }
      }
      if(truncated)return;
    }
  }
  await visit(root,'',0);
  return {items,truncated};
}
