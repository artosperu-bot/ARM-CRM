export function validateFollowup(dateString: string, description: string, now: number = Date.now()): string {
  if (description.trim().length < 3) throw new Error("Describe el seguimiento con al menos 3 caracteres.");
  const timestamp = new Date(dateString).getTime();
  if (!Number.isFinite(timestamp) || timestamp <= now) throw new Error("Selecciona una fecha y hora futuras.");
  return new Date(timestamp).toISOString();
}
