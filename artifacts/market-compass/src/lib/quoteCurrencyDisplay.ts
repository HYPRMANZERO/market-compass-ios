/** Protects the display currency of read-only source-dated market quotes.
 * A retained quote must never be relabeled when workspace currency changes.
 */
export type QuoteDisplayCurrency='ZAR'|'USD';
export function canDisplayQuoteInCurrency(
  snapshot:{currency:string}|null,
  selected:QuoteDisplayCurrency
):boolean {
  return snapshot!==null &&
    (snapshot.currency==='ZAR'||snapshot.currency==='USD') &&
    snapshot.currency===selected;
}
