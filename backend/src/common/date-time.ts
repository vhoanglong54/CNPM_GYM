export const APP_TIME_ZONE = 'Asia/Ho_Chi_Minh';

const appDateKeyFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: APP_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function appDayBounds(reference = new Date()) {
  const parts = appDateKeyFormatter.formatToParts(reference);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  const dateKey = `${value('year')}-${value('month')}-${value('day')}`;
  const start = new Date(`${dateKey}T00:00:00+07:00`);
  return { start, end: new Date(start.getTime() + 86_400_000) };
}

export function formatAppDateTime(value: Date) {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: APP_TIME_ZONE,
    dateStyle: 'short',
    timeStyle: 'medium',
    hour12: false,
  }).format(value);
}
