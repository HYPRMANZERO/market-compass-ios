/** Non-sensitive, per-browser opt-in preference; NOT stored in encrypted financial records. */
export const MARKET_DATA_SAVER_KEY='compass-market-data-saver-v1';
type ReadStorage=Pick<Storage,'getItem'>;
type WriteStorage=Pick<Storage,'setItem'>;

/** Default OFF. We never assume that the browser is on a metered network. */
export function loadMarketDataSaver(storage?:ReadStorage):boolean{
  try{
    const source=storage??(typeof window!=='undefined'?window.localStorage:null);
    return source?.getItem(MARKET_DATA_SAVER_KEY)==='on';
  }catch{return false;}
}
/** Never stores an account, credential, price, or other protected record. */
export function persistMarketDataSaver(enabled:boolean,storage?:WriteStorage):boolean{
  try{
    const destination=storage??(typeof window!=='undefined'?window.localStorage:null);
    if(!destination)return false;
    destination.setItem(MARKET_DATA_SAVER_KEY,enabled?'on':'off');
    return true;
  }catch{return false;}
}
