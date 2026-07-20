import { format, parse, isValid } from 'date-fns';

export function formatDay(iso: string): string {
  const d = new Date(iso);
  return isValid(d) ? format(d, 'MMM d, yyyy') : '';
}

export function formatDayShort(iso: string): string {
  const d = new Date(iso);
  return isValid(d) ? format(d, 'MMM d, yy') : '';
}

/** EXIF dates look like "2024:03:07 18:22:31". */
export function parseExifDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const d = parse(value, 'yyyy:MM:dd HH:mm:ss', new Date());
  return isValid(d) ? d.toISOString() : null;
}
