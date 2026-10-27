/**
 * The name a GB Snapshot shot gets: the model's name and the time down to the second (Keegan, digest 2026-10-27:
 * "add a string of time down to the seconds so that the user can save another ... if duck.png already exists").
 * Local time, no colons (file names), so two shots never share a name and the project never refuses the second.
 */
export function shotName(model: string, now: Date = new Date()): string {
  const two = (n: number) => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())} ${two(now.getHours())}-${two(now.getMinutes())}-${two(now.getSeconds())}`;
  return `${model.replace(/\.[^.]+$/, "")} ${stamp}`;
}
