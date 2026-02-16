import '../../globals.css'
import { useEffect, useState } from 'kaioken'
import { languages } from '../contentScript/languages'

type Theme = 'github-dark' | 'github-light' | 'monokai' | 'dracula' | 'dark-modern' | 'dark-plus' | 'monokai-dimmed' | 'dark-high-contrast' | 'night-owl' | 'tokyo-night' | 'synthwave-84' | 'gruvbox-dark' | 'solarized-light' | 'quiet-light' | 'light-plus' | 'auto';

interface Settings {
  enabled: boolean
  theme: Theme
  fontSize: number
}

const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  theme: 'auto',
  fontSize: 14,
}

function App() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [saved, setSaved] = useState(false)

  // Load settings on mount
  useEffect(() => {
    chrome.storage.sync.get(['settings'], (result) => {
      if (result.settings) {
        setSettings({ ...DEFAULT_SETTINGS, ...result.settings })
      }
    })
  }, [])

  // Save settings when changed
  const updateSettings = (newSettings: Partial<Settings>) => {
    const updated = { ...settings, ...newSettings }
    setSettings(updated)
    chrome.storage.sync.set({ settings: updated }, () => {
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    })
  }

  const toggleEnabled = () => {
    updateSettings({ enabled: !settings.enabled })
  }

  const changeTheme = (e: Event) => {
    const target = e.target as HTMLSelectElement
    updateSettings({ theme: target.value as Theme })
  }

  const changeFontSize = (e: Event) => {
    const target = e.target as HTMLInputElement
    updateSettings({ fontSize: parseInt(target.value) })
  }

  return (
    <main className="w-[320px] min-h-[200px] flex flex-col p-4 bg-white">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-200">
        <span className="text-xl">🎨</span>
        <h1 className="font-bold text-lg text-gray-800">Azure Syntax Highlighter</h1>
      </div>

      {/* Enable/Disable Toggle */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium text-gray-700">Syntax Highlighting</span>
        <button
          onclick={toggleEnabled}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            settings.enabled ? 'bg-blue-600' : 'bg-gray-300'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              settings.enabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* Theme Selection */}
      <div className="mb-4">
        <label htmlFor="theme-select" className="block text-sm font-medium text-gray-700 mb-1">
          Theme
        </label>
        <select
          id="theme-select"
          value={settings.theme}
          onchange={changeTheme}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <optgroup label="Auto">
            <option value="auto">Auto (match Azure DevOps)</option>
          </optgroup>
          <optgroup label="Light Themes">
            <option value="github-light">GitHub Light</option>
            <option value="solarized-light">Solarized Light</option>
            <option value="quiet-light">Quiet Light</option>
            <option value="light-plus">Light+ (VS Code)</option>
          </optgroup>
          <optgroup label="Dark Themes">
            <option value="github-dark">GitHub Dark</option>
            <option value="dark-modern">Dark Modern (VS Code)</option>
            <option value="dark-plus">Dark+ (VS Code)</option>
            <option value="monokai">Monokai</option>
            <option value="monokai-dimmed">Monokai Dimmed</option>
            <option value="dracula">Dracula</option>
            <option value="night-owl">Night Owl</option>
            <option value="tokyo-night">Tokyo Night</option>
            <option value="synthwave-84">Synthwave '84</option>
            <option value="gruvbox-dark">Gruvbox Dark</option>
            <option value="dark-high-contrast">Dark High Contrast</option>
          </optgroup>
        </select>
      </div>

      {/* Font Size Selection */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <label htmlFor="font-size-slider" className="block text-sm font-medium text-gray-700">
            Font Size
          </label>
          <span className="text-sm font-medium text-blue-600">{settings.fontSize}px</span>
        </div>
        <input
          id="font-size-slider"
          type="range"
          min="10"
          max="24"
          value={settings.fontSize}
          onchange={changeFontSize}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>10px</span>
          <span>24px</span>
        </div>
      </div>

      {/* Supported Languages */}
      <div className="mb-4">
        <h2 className="text-sm font-medium text-gray-700 mb-2">Supported Languages</h2>
        <div className="flex flex-wrap gap-1">
          {languages.map((lang) => (
            <span key={lang.hljs} className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
              {lang.name}
            </span>
          ))}
        </div>
      </div>

      {/* Status indicator */}
      <div className="mt-auto pt-3 border-t border-gray-200">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>
            Status:{' '}
            <span className={settings.enabled ? 'text-green-600' : 'text-gray-400'}>
              {settings.enabled ? '● Active' : '○ Disabled'}
            </span>
          </span>
          {saved && <span className="text-green-600">✓ Saved</span>}
        </div>
      </div>
    </main>
  )
}

export default App
