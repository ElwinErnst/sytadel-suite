export function formatName(input: {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
}) {
  const full = [input.firstName, input.lastName].filter(Boolean).join(' ').trim();
  return full || input.email || 'Usuario sin nombre';
}

export function formatBytes(value: number | string) {
  const size = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(size) || size <= 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB'];
  let current = size;
  let unitIndex = 0;

  while (current >= 1024 && unitIndex < units.length - 1) {
    current /= 1024;
    unitIndex += 1;
  }

  return `${current.toFixed(current >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
