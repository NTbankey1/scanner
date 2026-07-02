const KEYS = ['defaultDepth', 'defaultMaxUrls', 'defaultRateLimit'] as const;
const defaults: Record<string, string> = { defaultDepth: '3', defaultMaxUrls: '10000', defaultRateLimit: '300' };

async function loadSettings(): Promise<void> {
  const result = await chrome.storage.local.get(KEYS);
  for (const key of KEYS) {
    const el = document.getElementById(key) as HTMLInputElement;
    if (el) el.value = result[key] ?? defaults[key];
  }
}

async function saveSettings(): Promise<void> {
  const toSave: Record<string, string> = {};
  for (const key of KEYS) {
    const el = document.getElementById(key) as HTMLInputElement;
    if (el) toSave[key] = el.value;
  }
  await chrome.storage.local.set(toSave);
  const status = document.getElementById('status')!;
  status.textContent = 'Settings saved!';
  setTimeout(() => { status.textContent = ''; }, 2000);
}

document.getElementById('saveBtn')?.addEventListener('click', saveSettings);
loadSettings();
export {};
