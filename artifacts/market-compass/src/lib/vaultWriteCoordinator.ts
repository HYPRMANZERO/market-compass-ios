/**
 * Finish pending vault writes before persisting the latest unlocked snapshot.
 * A failed prior write is deliberately ignored ONLY because the next write
 * must replace it with the latest complete snapshot; final write failures
 * propagate and must keep the vault unlocked.
 *
 * This helper owns no passwords, paths or persistent data.
 */
export async function persistLatestAfterPending<T,RecordType>(
  pending:Promise<unknown>,
  snapshot:T,
  encrypt:(data:T)=>Promise<RecordType>,
  persist:(record:RecordType)=>Promise<void>
):Promise<RecordType>{
  try{await pending;}catch{ /* retry with latest snapshot rather than trusting stale storage */ }
  const record=await encrypt(snapshot);
  await persist(record);
  return record;
}
