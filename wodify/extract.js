// Turns saved raw responses ({ 'YYYY-MM-DD': text }) into clean workout text.

const stripHtml = (s) => s
  .replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li|h\d)>/gi, '\n')
  .replace(/<[^>]+>/g, '')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"')
  .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

// Strings that are clearly IDs, flags, timestamps or URLs rather than workout text.
const NOISE = [
  /^-?\d+(\.\d+)?$/, /^(true|false|null)$/i, /^[0-9a-f-]{20,}$/i,
  /^\d{4}-\d{2}-\d{2}(T[\d:.]+Z?)?$/, /^https?:\/\//i, /^[A-Za-z0-9+/=]{40,}$/,
];

function collectStrings(node, out) {
  if (typeof node === 'string') {
    const s = stripHtml(node);
    if (s.length > 1 && !NOISE.some((re) => re.test(s))) out.push(s);
  } else if (Array.isArray(node)) node.forEach((n) => collectStrings(n, out));
  else if (node && typeof node === 'object') Object.values(node).forEach((n) => collectStrings(n, out));
  return out;
}

function extractText(raw) {
  let parsed;
  try { parsed = JSON.parse(raw); } catch { return stripHtml(raw); }
  return [...new Set(collectStrings(parsed, []))].join('\n');
}

// Returns [{ date, workout }] sorted oldest first, days without a workout dropped.
export function buildWorkouts(rawByDate) {
  const texts = Object.keys(rawByDate).sort().map((date) => ({ date, text: extractText(rawByDate[date]) }));

  // Text that shows up on nearly every day, workout or not (program name, UI labels), is boilerplate.
  const lineCounts = new Map();
  for (const { text } of texts) for (const line of new Set(text.split('\n'))) lineCounts.set(line, (lineCounts.get(line) || 0) + 1);
  const common = new Set([...lineCounts].filter(([, n]) => texts.length >= 20 && n / texts.length > 0.9).map(([l]) => l));

  return texts
    .map(({ date, text }) => ({ date, workout: text.split('\n').filter((l) => !common.has(l)).join('\n').trim() }))
    .filter((w) => w.workout.length > 0);
}

export const toJson = (workouts) => JSON.stringify(workouts, null, 2);

export const toCsv = (workouts) =>
  'date,workout\n' + workouts.map((w) => `${w.date},"${w.workout.replace(/"/g, '""')}"`).join('\n') + '\n';

export const toMarkdown = (workouts) =>
  '# Workouts\n\n' + workouts.slice().reverse().map((w) => `## ${w.date}\n\n${w.workout}\n`).join('\n');
