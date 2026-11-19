export const BACKUP_SETTINGS_KEY = 'market-compass-daily-backup-settings-v1';
export type DailyBackupSettings = { enabled: boolean; time: string; lastSnapshotDate: string; lastExportRequestedAt: string };
export const DEFAULT_BACKUP_SETTINGS: DailyBackupSettings = { enabled: false, time: '20:00', lastSnapshotDate: '', lastExportRequestedAt: '' };
export function localDate(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
export function loadDailyBackupSettings(): DailyBackupSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(BACKUP_SETTINGS_KEY) ?? '{}') as Partial<DailyBackupSettings>;
    return { ...DEFAULT_BACKUP_SETTINGS, ...saved, time: /^([01]\d|2[0-3]):[0-5]\d$/.test(saved.time ?? '') ? saved.time! : DEFAULT_BACKUP_SETTINGS.time };
  } catch { return { ...DEFAULT_BACKUP_SETTINGS }; }
}
export function persistDailyBackupSettings(value: DailyBackupSettings) {
  localStorage.setItem(BACKUP_SETTINGS_KEY, JSON.stringify(value));
}
export function backupDue(settings: DailyBackupSettings, now = new Date()): boolean {
  if (!settings.enabled || settings.lastSnapshotDate === localDate(now)) return false;
  const pad = (n: number) => String(n).padStart(2, '0');
  const clock = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  return clock >= settings.time;
}
