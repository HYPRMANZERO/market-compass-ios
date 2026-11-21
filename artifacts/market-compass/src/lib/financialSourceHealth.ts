/**
 * M1.2 browser presentation contract for the authenticated /api/sources metadata.
 * This module accepts ONLY the bounded, read-only backend status schema.
 * It never interprets missing records as zero money or recent entries as live bank feeds.
 */
export type SourceId = 'historical_plan' | 'owner_accounts' | 'statement_exports' | 'email_exports';
export type SourceStatus = 'missing' | 'historical' | 'recent_record' | 'stale' | 'unknown_date';
export type SourceKind = 'planning_baseline' | 'manual_accounts' | 'imported_statements' | 'imported_emails';

export type SourceHealthEntry = {
  id: SourceId;
  kind: SourceKind;
  recordCount: number;
  status: SourceStatus;
  lastRecordedAt: string | null;
  ageDays: number | null;
  bankVerified: false;
  liveProvider: false;
};

export type FinancialSourceHealth = {
  schema: 'market-compass-source-health-v1';
  checkedAt: string;
  readOnly: true;
  bankOAuthConnected: false;
  bankVerifiedCurrentBalance: false;
  liveBankFeeds: 0;
  warningCount: number;
  sources: SourceHealthEntry[];
};

const KINDS: Record<SourceId, SourceKind> = {
  historical_plan: 'planning_baseline',
  owner_accounts: 'manual_accounts',
  statement_exports: 'imported_statements',
  email_exports: 'imported_emails',
};
const SOURCE_IDS = Object.keys(KINDS) as SourceId[];
const STATUSES = new Set<SourceStatus>(['missing', 'historical', 'recent_record', 'stale', 'unknown_date']);
const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

export const sourceLabels: Record<SourceId, string> = {
  historical_plan: 'Original financial plan',
  owner_accounts: 'Desktop account entries',
  statement_exports: 'Imported statements',
  email_exports: 'Exported financial emails',
};

export const statusLabels: Record<SourceStatus, string> = {
  missing: 'Not available',
  historical: 'Historical only',
  recent_record: 'Recently recorded · not verified',
  stale: 'Record is old',
  unknown_date: 'Date unverified',
};

/** A bad or unfamiliar response fails closed; raw provider records never reach this view. */
export function parseFinancialSourceHealth(value: unknown): FinancialSourceHealth | null {
  if (!isRecord(value) ||
      value.schema !== 'market-compass-source-health-v1' ||
      value.readOnly !== true ||
      value.bankOAuthConnected !== false ||
      value.bankVerifiedCurrentBalance !== false ||
      value.liveBankFeeds !== 0 ||
      typeof value.checkedAt !== 'string' ||
      !Number.isFinite(Date.parse(value.checkedAt)) ||
      !Number.isInteger(value.warningCount) ||
      (value.warningCount as number) < 0 ||
      (value.warningCount as number) > 100 ||
      !Array.isArray(value.sources) || value.sources.length !== SOURCE_IDS.length) return null;

  const found = new Set<SourceId>();
  const sources: SourceHealthEntry[] = [];
  for (const item of value.sources) {
    if (!isRecord(item) ||
        typeof item.id !== 'string' ||
        !Object.prototype.hasOwnProperty.call(KINDS, item.id)) return null;

    const id = item.id as SourceId;
    if (found.has(id) || item.kind !== KINDS[id] ||
        typeof item.status !== 'string' || !STATUSES.has(item.status as SourceStatus) ||
        !Number.isInteger(item.recordCount) || (item.recordCount as number) < 0 ||
        (item.recordCount as number) > 50 ||
        item.bankVerified !== false || item.liveProvider !== false ||
        (item.lastRecordedAt !== null &&
         (typeof item.lastRecordedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(item.lastRecordedAt))) ||
        (item.ageDays !== null &&
         (!Number.isInteger(item.ageDays) || (item.ageDays as number) < 0)) ||
        (item.status === 'missing' && (item.recordCount !== 0 || item.lastRecordedAt !== null)) ||
        (item.status !== 'missing' && item.recordCount === 0)) return null;

    found.add(id);
    // Whitelist fields: even if a compromised upstream sends other values,
    // do not put descriptions, account names, file paths or amounts into state.
    sources.push({
      id, kind: KINDS[id], status: item.status as SourceStatus,
      recordCount: item.recordCount as number,
      lastRecordedAt: item.lastRecordedAt as string | null,
      ageDays: item.ageDays as number | null,
      bankVerified: false, liveProvider: false,
    });
  }

  return {
    schema: 'market-compass-source-health-v1',
    checkedAt: value.checkedAt,
    readOnly: true, bankOAuthConnected: false,
    bankVerifiedCurrentBalance: false, liveBankFeeds: 0,
    warningCount: value.warningCount as number,
    sources: SOURCE_IDS.map(id => sources.find(x => x.id === id)!),
  };
}
