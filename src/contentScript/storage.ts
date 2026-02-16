/**
 * Storage utilities for user preferences
 */

export interface UserSettings {
  enabled: boolean
  theme:
    | 'github-dark'
    | 'github-light'
    | 'monokai'
    | 'dracula'
    | 'dark-modern'
    | 'dark-plus'
    | 'monokai-dimmed'
    | 'dark-high-contrast'
    | 'night-owl'
    | 'tokyo-night'
    | 'synthwave-84'
    | 'gruvbox-dark'
    | 'solarized-light'
    | 'quiet-light'
    | 'light-plus'
    | 'auto'
  fontSize: number
}

export const DEFAULT_SETTINGS: UserSettings = {
  enabled: true,
  theme: 'auto',
  fontSize: 14,
}

/**
 * Get user settings from chrome.storage.sync
 */
export async function getSettings(): Promise<UserSettings> {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['settings'], (result) => {
      resolve({ ...DEFAULT_SETTINGS, ...result.settings })
    })
  })
}

/**
 * Save user settings to chrome.storage.sync
 */
export async function saveSettings(settings: Partial<UserSettings>): Promise<UserSettings> {
  const current = await getSettings()
  const updated = { ...current, ...settings }

  return new Promise((resolve) => {
    chrome.storage.sync.set({ settings: updated }, () => {
      resolve(updated)
    })
  })
}

/**
 * Listen for settings changes
 */
export function onSettingsChange(callback: (settings: UserSettings) => void): void {
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync' && changes.settings) {
      callback({ ...DEFAULT_SETTINGS, ...changes.settings.newValue })
    }
  })
}
