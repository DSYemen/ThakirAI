
import { AppSettings } from '../types';

const SETTINGS_KEY = 'thakira_app_settings';

// Helper to guess default timezone
const getDefaultTimeZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (e) {
    return 'UTC';
  }
};

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  aiModel: 'gemini-2.5-flash',
  apiKey: '',
  autoSaveMedia: false,
  customMediaFolder: 'Thakira_Media',
  timeZone: getDefaultTimeZone(),
  language: 'ar-SA'
};

export const getSettings = (): AppSettings => {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) {
      // Merge saved settings with defaults to ensure new fields exist
      return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.error("Failed to load settings", e);
  }
  return DEFAULT_SETTINGS;
};

export const saveSettings = (settings: AppSettings): void => {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  applyTheme(settings.theme);
};

export const applyTheme = (theme: 'dark' | 'light') => {
  const root = document.documentElement;
  if (theme === 'light') {
    root.classList.add('light');
    root.classList.remove('dark');
  } else {
    root.classList.add('dark');
    root.classList.remove('light');
  }
};
