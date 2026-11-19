/** Local-only encrypted workspace. Format is versioned for future migrations.
 * AES-256-GCM after gzip; PBKDF2-SHA-256 derives a key from a user passphrase.
 * No password or encryption key is persisted.
 */
const DATABASE = 'market-compass-local-vault';
const OBJECT_STORE = 'records';
const RECORD_KEY = 'workspace';
const ROUNDS = 310_000;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export type EncryptedRecord = {
  version: 1 | 2;
  kdf: 'PBKDF2-SHA256';
  iterations: number;
  cipher: 'AES-256-GCM';
  compression: 'gzip' | 'none';
  originalBytes?: number;
  packedBytes?: number;
  salt: string;
  iv: string;
  ciphertext: string;
  updatedAt: string;
};

function bytesToBase64(bytes: Uint8Array): string {
  let text = '';
  // Chunked encoding prevents large backup files from exceeding apply argument limits.
  for (let i = 0; i < bytes.length; i += 8192) text += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(text);
}
function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
function buffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}
async function derive(password: string, salt: Uint8Array, iterations = ROUNDS): Promise<CryptoKey> {
  if (!password) throw new Error('Enter the vault password.');
  const material = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: buffer(salt), iterations, hash: 'SHA-256' }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function compress(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof CompressionStream === 'undefined') throw new Error('Gzip compression is unavailable in this browser.');
  const stream = new CompressionStream('gzip');
  const output = new Response(new Blob([buffer(bytes)]).stream().pipeThrough(stream)).arrayBuffer();
  return new Uint8Array(await output);
}
async function decompress(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') throw new Error('Gzip decompression is unavailable in this browser.');
  const stream = new DecompressionStream('gzip');
  return new Uint8Array(await new Response(new Blob([buffer(bytes)]).stream().pipeThrough(stream)).arrayBuffer());
}
/** CompactVault-inspired adaptive packing: use gzip only when it wins. */
export async function encryptWorkspace(value: unknown, password: string): Promise<EncryptedRecord> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await derive(password, salt);
  const plain = encoder.encode(JSON.stringify(value));
  const zipped = await compress(plain);
  const useGzip = zipped.length < plain.length;
  const packed = useGzip ? zipped : plain;
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: buffer(iv) }, key, buffer(packed));
  return { version: 2, kdf: 'PBKDF2-SHA256', iterations: ROUNDS, cipher: 'AES-256-GCM', compression: useGzip ? 'gzip' : 'none',
    originalBytes: plain.byteLength, packedBytes: packed.byteLength,
    salt: bytesToBase64(salt), iv: bytesToBase64(iv), ciphertext: bytesToBase64(new Uint8Array(ciphertext)), updatedAt: new Date().toISOString() };
}
export function validateRecord(value: unknown): asserts value is EncryptedRecord {
  if (!value || typeof value !== 'object') throw new Error('Invalid encrypted vault file.');
  const v = value as Partial<EncryptedRecord>;
  if ((v.version !== 1 && v.version !== 2) || v.kdf !== 'PBKDF2-SHA256' || v.cipher !== 'AES-256-GCM' ||
      (v.compression !== 'gzip' && !(v.version === 2 && v.compression === 'none')) ||
      v.iterations !== ROUNDS || typeof v.salt !== 'string' || typeof v.iv !== 'string' ||
      typeof v.ciphertext !== 'string' || typeof v.updatedAt !== 'string') {
    throw new Error('Unsupported or damaged encrypted vault file.');
  }
  if (v.version === 2 && (!Number.isSafeInteger(v.originalBytes) || !Number.isSafeInteger(v.packedBytes) ||
    (v.originalBytes ?? -1) < 0 || (v.packedBytes ?? -1) < 0)) throw new Error('Invalid compression metadata.');
}
export async function decryptWorkspace<T>(record: EncryptedRecord, password: string): Promise<T> {
  validateRecord(record);
  const salt = base64ToBytes(record.salt); const iv = base64ToBytes(record.iv);
  if (salt.length !== 16 || iv.length !== 12) throw new Error('Invalid vault metadata.');
  const key = await derive(password, salt, record.iterations);
  try {
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buffer(iv) }, key, buffer(base64ToBytes(record.ciphertext)));
    const packed = new Uint8Array(decrypted);
    if (record.version === 2 && record.packedBytes !== packed.length) throw new Error('Damaged compressed payload');
    const plaintext = record.compression === 'gzip' ? await decompress(packed) : packed;
    if (record.version === 2 && record.originalBytes !== plaintext.length) throw new Error('Damaged decompressed payload');
    return JSON.parse(decoder.decode(plaintext)) as T;
  } catch { throw new Error('Incorrect password or damaged encrypted vault.'); }
}
export function compressionSummary(record: EncryptedRecord | null): string {
  if (!record || record.originalBytes === undefined || record.packedBytes === undefined) return 'Compression report available after next save';
  const saved = record.originalBytes - record.packedBytes;
  const percent = record.originalBytes ? Math.max(0, (saved / record.originalBytes) * 100) : 0;
  return `${record.compression === 'gzip' ? 'Adaptive gzip' : 'Raw (smaller than gzip)'} · ${percent.toFixed(1)}% saved · ${record.originalBytes.toLocaleString()} → ${record.packedBytes.toLocaleString()} bytes before encryption`;
}
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(OBJECT_STORE)) request.result.createObjectStore(OBJECT_STORE); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Cannot open local storage'));
  });
}
export async function readVault(): Promise<EncryptedRecord | null> {
  const db = await openDb();
  try { return await new Promise((resolve, reject) => {
    const req = db.transaction(OBJECT_STORE, 'readonly').objectStore(OBJECT_STORE).get(RECORD_KEY);
    req.onsuccess = () => resolve((req.result as EncryptedRecord | undefined) ?? null);
    req.onerror = () => reject(req.error);
  }); } finally { db.close(); }
}
export async function writeVault(record: EncryptedRecord): Promise<void> {
  validateRecord(record);
  const db = await openDb();
  try { await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(OBJECT_STORE, 'readwrite');
    tx.objectStore(OBJECT_STORE).put(record, RECORD_KEY);
    tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
  }); } finally { db.close(); }
}
export function downloadVault(record: EncryptedRecord): void {
  const blob = new Blob([JSON.stringify(record)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const element = document.createElement('a'); element.href = url;
  element.download = `market-compass-${new Date().toISOString().slice(0, 10)}.mc-vault.json`;
  document.body.appendChild(element); element.click(); element.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}


/** Export via iOS Share sheet when available; use download on other browsers. */
export async function shareVaultToFiles(record: EncryptedRecord): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const filename = `market-compass-${new Date().toISOString().replace(/[:.]/g, '-')}.mc-vault.json`;
  const file = new File([JSON.stringify(record)], filename, { type: 'application/json' });
  if (typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Encrypted Market Compass backup' });
      // A successful share means it was passed to the recipient, not that Files stored it.
      return 'shared';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
      throw e;
    }
  }
  downloadVault(record);
  return 'downloaded';
}

const DAILY_PREFIX = 'daily-backup-';
/** Keep seven encrypted daily restore points in IndexedDB, separately from live workspace. */
export async function storeDailySnapshot(record: EncryptedRecord, date: string): Promise<void> {
  validateRecord(record);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Invalid backup date');
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(OBJECT_STORE, 'readwrite');
      const store = tx.objectStore(OBJECT_STORE);
      store.put(record, DAILY_PREFIX + date);
      const request = store.getAllKeys();
      request.onsuccess = () => {
        const keys = request.result.filter((key): key is string => typeof key === 'string' && key.startsWith(DAILY_PREFIX)).sort();
        for (const key of keys.slice(0, Math.max(0, keys.length - 7))) store.delete(key);
      };
      tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}
