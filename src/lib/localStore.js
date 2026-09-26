const REPORTS_KEY = 'abidi-daily-reports-v3';
const LEGACY_REPORTS_KEYS = ['abidi-daily-reports-v1', 'abidi-daily-reports-v2'];
const SESSION_KEY = 'abidi-daily-session-v1';

export function loadLocalReports() {
  // Discard the old prototype/demo dataset once, then start with a clean store.
  LEGACY_REPORTS_KEYS.forEach((key) => localStorage.removeItem(key));
  try {
    const saved = JSON.parse(localStorage.getItem(REPORTS_KEY) || '[]');
    if (Array.isArray(saved)) return saved;
  } catch {}
  return [];
}

export function saveLocalReports(reports) {
  localStorage.setItem(REPORTS_KEY, JSON.stringify(reports));
}

export function loadLocalSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
  } catch {
    return null;
  }
}

export function saveLocalSession(session) {
  if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  else localStorage.removeItem(SESSION_KEY);
}
