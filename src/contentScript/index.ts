/**
 * Azure DevOps Syntax Highlighter - Content Script
 *
 * Detects code diffs in Azure DevOps pull request pages and applies
 * syntax highlighting using highlight.js
 */

// Immediate log to verify script is running - BEFORE any imports
console.log('[Azure Syntax Highlighter] Content script file starting to load...')

try {
  console.log('[Azure Syntax Highlighter] About to import highlight.js...')
} catch (e) {
  console.error('[Azure Syntax Highlighter] Early error:', e)
}

import hljs from 'highlight.js/lib/core'

console.log('[Azure Syntax Highlighter] highlight.js imported successfully')

// Import languages we support
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import json from 'highlight.js/lib/languages/json'
import xml from 'highlight.js/lib/languages/xml'
import css from 'highlight.js/lib/languages/css'
import scss from 'highlight.js/lib/languages/scss'

import { getLanguageForExtension, getExtensionFromPath } from './languages'
import { getSettings, onSettingsChange, type UserSettings } from './storage'

// Register languages with highlight.js
hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('json', json)
hljs.registerLanguage('xml', xml)
hljs.registerLanguage('css', css)
hljs.registerLanguage('scss', scss)

// Track current settings
let currentSettings: UserSettings = {
  enabled: true,
  theme: 'auto',
  fontSize: 14,
}

// Style injection element
let styleElement: HTMLStyleElement | null = null

/**
 * Create or update the injected stylesheet for dynamic settings
 */
function updateInjectedStyles(): void {
  // Remove old style element if it exists
  if (styleElement && styleElement.parentElement) {
    styleElement.remove()
    styleElement = null
  }

  // Create new style element
  styleElement = document.createElement('style')
  styleElement.id = 'azure-syntax-highlighter-styles'

  // Calculate height: fontSize + 4px padding
  const calculatedHeight = currentSettings.fontSize + 4

  const css = `
    .view-line {
      height: ${calculatedHeight}px !important;
      top: auto !important;
    }
    .azure-syntax-highlighted {
      font-size: ${currentSettings.fontSize}px !important;
    }
  `

  styleElement.textContent = css
  document.head.appendChild(styleElement)

  // Now recalculate top positions for each .view-line element
  const viewLines = document.querySelectorAll('.view-line')
  viewLines.forEach((line, index) => {
    if (line instanceof HTMLElement) {
      const topPosition = index * calculatedHeight
      line.style.top = `${topPosition}px`
    }
  })

  console.log(
    `[Azure Syntax Highlighter] Injected styles: fontSize=${currentSettings.fontSize}px, height=${calculatedHeight}px, repositioned ${viewLines.length} lines`,
  )
}

// Track highlighted elements to avoid re-processing
const highlightedElements = new WeakSet<Element>()

/**
 * Detect if Azure DevOps is in dark mode
 */
function isAzureDevOpsDarkMode(): boolean {
  // Azure DevOps uses various ways to indicate dark mode
  const body = document.body
  const html = document.documentElement

  // Check data-theme attributes (Azure DevOps standard)
  if (body.dataset.theme?.includes('dark') || html.dataset.theme?.includes('dark')) {
    return true
  }

  // Check for dark theme classes
  if (
    body.classList.contains('dark-theme') ||
    body.classList.contains('theme-dark') ||
    html.classList.contains('dark-theme') ||
    html.classList.contains('theme-dark')
  ) {
    return true
  }

  // Check for Azure DevOps specific dark mode indicator
  // Azure DevOps uses .vss-style-dark or data-* attributes
  if (body.classList.contains('vss-style-dark') || html.classList.contains('vss-style-dark')) {
    return true
  }

  // Check for color-scheme meta or CSS property
  const colorScheme = getComputedStyle(html).colorScheme
  if (colorScheme === 'dark') {
    return true
  }

  // Fallback: check computed background color of body
  // Dark themes typically have low RGB values
  const bgColor = getComputedStyle(body).backgroundColor
  const rgbMatch = bgColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1])
    const g = parseInt(rgbMatch[2])
    const b = parseInt(rgbMatch[3])
    // If average color value is less than 50, it's likely dark
    if ((r + g + b) / 3 < 50) {
      return true
    }
  }

  return false
}

/**
 * Get the current theme class based on settings
 */
function getThemeClass(): string {
  if (currentSettings.theme === 'auto') {
    return isAzureDevOpsDarkMode() ? 'hljs-github-dark' : 'hljs-github-light'
  }
  return `hljs-${currentSettings.theme}`
}

const THEME_CLASSES = [
  'hljs-github-light',
  'hljs-github-dark',
  'hljs-monokai',
  'hljs-dracula',
  'hljs-dark-modern',
  'hljs-dark-plus',
  'hljs-monokai-dimmed',
  'hljs-dark-high-contrast',
  'hljs-night-owl',
  'hljs-tokyo-night',
  'hljs-synthwave-84',
  'hljs-gruvbox-dark',
  'hljs-solarized-light',
  'hljs-quiet-light',
  'hljs-light-plus',
]

// Theme background colors
const THEME_BACKGROUNDS: Record<string, string> = {
  'hljs-github-light': '#f6f8fa',
  'hljs-github-dark': '#0d1117',
  'hljs-monokai': '#272822',
  'hljs-dracula': '#282a36',
  'hljs-dark-modern': '#1f1f1f',
  'hljs-dark-plus': '#1e1e1e',
  'hljs-monokai-dimmed': '#1e1e1e',
  'hljs-dark-high-contrast': '#000000',
  'hljs-night-owl': '#011627',
  'hljs-tokyo-night': '#1a1b26',
  'hljs-synthwave-84': '#262335',
  'hljs-gruvbox-dark': '#282828',
  'hljs-solarized-light': '#fdf6e3',
  'hljs-quiet-light': '#f5f5f5',
  'hljs-light-plus': '#ffffff',
}

// Theme line number colors
const THEME_LINE_COLORS: Record<string, string> = {
  'hljs-github-light': '#1f2328',
  'hljs-github-dark': '#6e7681',
  'hljs-monokai': '#90908a',
  'hljs-dracula': '#6272a4',
  'hljs-dark-modern': '#6e7681',
  'hljs-dark-plus': '#858585',
  'hljs-monokai-dimmed': '#90908a',
  'hljs-dark-high-contrast': '#ffffff',
  'hljs-night-owl': '#4b6479',
  'hljs-tokyo-night': '#3b4261',
  'hljs-synthwave-84': '#848bbd',
  'hljs-gruvbox-dark': '#665c54',
  'hljs-solarized-light': '#839496',
  'hljs-quiet-light': '#333333',
  'hljs-light-plus': '#237893',
}

/**
 * Apply background color directly to Monaco editor elements using inline styles
 */
function applyMonacoBackground(
  editor: Element,
  backgroundColor: string | null,
  lineColor: string | null,
): void {
  console.log(
    `[Azure Syntax Highlighter] Applying background: ${backgroundColor}, lineColor: ${lineColor}`,
  )

  const backgroundSelectors = [
    '.monaco-editor-background',
    '.lines-content',
    '.margin',
    '.overflow-guard',
  ]

  backgroundSelectors.forEach((selector) => {
    const elements = editor.querySelectorAll(selector)
    console.log(
      `[Azure Syntax Highlighter] Found ${elements.length} elements for selector: ${selector}`,
    )
    elements.forEach((el) => {
      if (el instanceof HTMLElement) {
        if (backgroundColor) {
          el.style.setProperty('background-color', backgroundColor, 'important')
        } else {
          el.style.removeProperty('background-color')
        }
      }
    })
  })

  // Also style line numbers
  const lineNumbers = editor.querySelectorAll('.line-numbers')
  lineNumbers.forEach((el) => {
    if (el instanceof HTMLElement) {
      if (lineColor) {
        el.style.setProperty('color', lineColor, 'important')
      } else {
        el.style.removeProperty('color')
      }
    }
  })

  // Style current line
  const currentLines = editor.querySelectorAll('.view-overlays .current-line')
  currentLines.forEach((el) => {
    if (el instanceof HTMLElement) {
      if (backgroundColor) {
        el.style.setProperty('background-color', backgroundColor, 'important')
      } else {
        el.style.removeProperty('background-color')
      }
    }
  })
}

/**
 * Update font size on all already-highlighted elements
 */
function updateHighlightedFontSize(fontSize: number): void {
  console.log(`[Azure Syntax Highlighter] Font size changed to ${fontSize}px`)
  updateInjectedStyles()
}

/**
 * Update theme classes on all already-highlighted elements and Monaco editors
 */
function updateHighlightedThemes(): void {
  const newThemeClass = getThemeClass()
  const highlightedSpans = document.querySelectorAll('.azure-syntax-highlighted')

  console.log(
    `[Azure Syntax Highlighter] Updating ${highlightedSpans.length} elements to theme: ${newThemeClass}`,
  )
  console.log(`[Azure Syntax Highlighter] THEME_BACKGROUNDS keys:`, Object.keys(THEME_BACKGROUNDS))
  console.log(
    `[Azure Syntax Highlighter] Background for ${newThemeClass}:`,
    THEME_BACKGROUNDS[newThemeClass],
  )

  highlightedSpans.forEach((span) => {
    // Remove all theme classes and add new one
    span.classList.remove(...THEME_CLASSES)
    span.classList.add(newThemeClass)
  })

  // Update Monaco editor containers with inline styles
  updateMonacoEditorThemes(newThemeClass)
}

/**
 * Apply theme to Monaco editor containers using inline styles
 */
function updateMonacoEditorThemes(themeClass: string): void {
  const monacoEditors = document.querySelectorAll('.monaco-editor.azure-syntax-editor')
  const backgroundColor = THEME_BACKGROUNDS[themeClass] || null
  const lineColor = THEME_LINE_COLORS[themeClass] || null

  console.log(
    `[Azure Syntax Highlighter] updateMonacoEditorThemes: themeClass=${themeClass}, bg=${backgroundColor}, ${monacoEditors.length} editors`,
  )

  monacoEditors.forEach((editor) => {
    applyMonacoBackground(editor, backgroundColor, lineColor)
  })
}

/**
 * Remove all syntax highlighting from the page
 */
function removeAllHighlighting(): void {
  const highlightedSpans = document.querySelectorAll('.azure-syntax-highlighted')
  console.log(
    `[Azure Syntax Highlighter] Removing highlighting from ${highlightedSpans.length} elements`,
  )

  highlightedSpans.forEach((span) => {
    // Get the text content and replace the span with just text
    const textContent = span.textContent || ''
    const parent = span.parentElement
    if (parent) {
      parent.textContent = textContent
    }
  })

  // Clear the WeakSet by creating a new one (can't clear WeakSet directly)
  // This is handled by the page refresh or navigation
}

/**
 * Toggle highlighting visibility without removing elements
 */
function setHighlightingVisible(visible: boolean): void {
  const highlightedSpans = document.querySelectorAll('.azure-syntax-highlighted')
  const monacoEditors = document.querySelectorAll('.monaco-editor.azure-syntax-editor')
  console.log(
    `[Azure Syntax Highlighter] Setting visibility to ${visible} for ${highlightedSpans.length} elements, ${monacoEditors.length} editors`,
  )

  highlightedSpans.forEach((span) => {
    if (visible) {
      span.classList.remove('azure-syntax-hidden')
    } else {
      span.classList.add('azure-syntax-hidden')
    }
  })

  // Toggle Monaco editor backgrounds using inline styles
  const themeClass = getThemeClass()
  monacoEditors.forEach((editor) => {
    if (visible) {
      // Re-apply theme colors
      const backgroundColor = THEME_BACKGROUNDS[themeClass] || null
      const lineColor = THEME_LINE_COLORS[themeClass] || null
      applyMonacoBackground(editor, backgroundColor, lineColor)
    } else {
      // Remove all our inline styles to restore original
      applyMonacoBackground(editor, null, null)
    }
  })
}

/**
 * Check if we're currently on a pull request page
 */
function isPullRequestPage(): boolean {
  return /\/pullrequest\/\d+/i.test(globalThis.location.href)
}

/**
 * Find the current file name from the Azure DevOps UI
 */
function getCurrentFileName(): string | null {
  // Try different selectors for file name in Azure DevOps PR view
  const selectors = [
    // PR-specific selectors
    '.repos-file-header .bolt-header-title',
    '.repos-file-header [class*="fileName"]',
    // Files diff view in PR
    '.repos-diff-viewer-header .file-path',
    '.repos-diff-contents-header .file-name',
    // General file viewing
    '.repos-summary-header .file-name',
    '.file-path',
    '.repos-changes-explorer-item.selected .file-name',
    '[data-focuszone-id] .file-name',
    '.repos-changes-viewer-header .text-ellipsis',
    '.file-header .file-path',
    // Breadcrumb in file viewer
    '.repos-file-header .breadcrumb-item:last-child',
    // Additional Azure DevOps selectors
    '.bolt-header-title',
    '.repos-compare-toolbar .secondary-text',
    '[class*="fileName"]',
    '[class*="file-path"]',
    '.diff-header-file-name',
    // PR file item (when file list is visible)
    '.file-explorer-item-name',
    '[role="treeitem"] [class*="filename"]',
  ]

  for (const selector of selectors) {
    const el = document.querySelector(selector)
    if (el?.textContent) {
      const filename = el.textContent.trim()
      if (filename && !filename.includes('.azure.com')) {
        console.log(
          `[Azure Syntax Highlighter] Found filename with selector "${selector}":`,
          filename,
        )
        return filename
      }
    }
  }

  // For PR views, try to get from breadcrumb navigation
  if (isPullRequestPage()) {
    const breadcrumbs = document.querySelectorAll('[class*="breadcrumb"]')
    for (const breadcrumb of breadcrumbs) {
      const text = breadcrumb.textContent?.trim()
      if (text && text.includes('.')) {
        // This looks like a filename
        const matches = text.match(/[\w\-_.]+\.\w+/)
        if (matches) {
          console.log('[Azure Syntax Highlighter] Found filename from breadcrumb:', matches[0])
          return matches[0]
        }
      }
    }
  }

  // Try to get from URL - check for path parameter
  const urlMatch = /\/pullrequest\/\d+.*[?&]path=([^&]+)/i.exec(globalThis.location.href)
  if (urlMatch) {
    const path = decodeURIComponent(urlMatch[1])
    console.log('[Azure Syntax Highlighter] Got filename from URL path param:', path)
    return path
  }

  // Try to extract from iteration path in URL
  const iterationMatch = /iteration=\d+&base=\d+&path=([^&]+)/i.exec(globalThis.location.href)
  if (iterationMatch) {
    const path = decodeURIComponent(iterationMatch[1])
    console.log('[Azure Syntax Highlighter] Got filename from iteration path:', path)
    return path
  }

  // Debug log (not an error) - this is normal when on PR overview or non-file pages
  if (isPullRequestPage()) {
    console.debug(
      '[Azure Syntax Highlighter] No specific file detected in PR view. Select a file to view syntax highlighting.',
    )
  } else {
    console.debug('[Azure Syntax Highlighter] No filename found. URL:', globalThis.location.href)
  }
  return null
}

/**
 * Check if an element is inside the file explorer sidebar (should NOT be highlighted)
 */
function isInSidebar(element: Element): boolean {
  return (
    element.closest(
      '.repos-changes-explorer-tree, .repos-file-explorer-tree, .vss-Splitter--pane-fixed, .bolt-table-container, .pr-files-list, .repos-files-changed-navigator',
    ) !== null
  )
}

/**
 * Apply syntax highlighting to a code line element
 */
function highlightCodeLine(lineElement: Element, language: string): void {
  if (highlightedElements.has(lineElement)) {
    return
  }

  // Skip if this element is in the sidebar
  if (isInSidebar(lineElement)) {
    return
  }

  // Find the actual code content within the line
  const codeContent = lineElement.querySelector(
    '.code-line-content, .repos-line-content, td.content',
  )
  const target = codeContent || lineElement

  // Get the text content and replace Monaco whitespace dots with actual spaces
  const rawCode = target.textContent || ''
  // Monaco renders whitespace as middle-dot (·) characters - convert them back to spaces
  const code = rawCode.replace(/·/g, ' ')
  if (!code.trim()) {
    return
  }

  try {
    const result = hljs.highlight(code, { language, ignoreIllegals: true })
    const themeClass = getThemeClass()

    // Create a span with highlighted content
    const highlightedSpan = document.createElement('span')
    highlightedSpan.innerHTML = result.value
    highlightedSpan.className = `azure-syntax-highlighted ${themeClass}`
    // Apply font size immediately
    highlightedSpan.style.fontSize = `${currentSettings.fontSize}px`

    // Replace content while preserving structure
    target.innerHTML = ''
    target.appendChild(highlightedSpan)

    highlightedElements.add(lineElement)

    // Mark the Monaco editor container and apply inline background styles
    const monacoEditor = lineElement.closest('.monaco-editor')
    if (monacoEditor && !monacoEditor.classList.contains('azure-syntax-editor')) {
      monacoEditor.classList.add('azure-syntax-editor')
      // Apply background color immediately using inline styles
      const backgroundColor = THEME_BACKGROUNDS[themeClass] || null
      const lineColor = THEME_LINE_COLORS[themeClass] || null
      applyMonacoBackground(monacoEditor, backgroundColor, lineColor)
    }
  } catch (err) {
    console.warn('[Azure Syntax Highlighter] Failed to highlight:', err)
  }
}

/**
 * Process all code lines in the current view
 */
function processCodeLines(): void {
  if (!currentSettings.enabled) {
    return
  }

  const fileName = getCurrentFileName()
  if (!fileName) {
    return
  }

  const extension = getExtensionFromPath(fileName)
  const language = getLanguageForExtension(extension)

  if (!language) {
    return
  }

  console.log(`[Azure Syntax Highlighter] Processing ${fileName} as ${language}`)

  // Selectors for actual code diff lines (NOT file tree/sidebar)
  const lineSelectors = [
    // Monaco editor lines (used in Azure DevOps diff view)
    '.monaco-editor .view-line',
    // Specific diff content areas
    '.repos-diff-contents .view-line',
    '.repos-summary-diff .view-line',
    // PR-specific diff viewers
    '.repos-file-content .view-line',
    '.repos-code-viewer .view-line',
    // Legacy selectors
    '.repos-line-content',
    '.code-line-content',
  ]

  let totalFound = 0
  for (const selector of lineSelectors) {
    const lines = document.querySelectorAll(selector)
    if (lines.length > 0) {
      console.log(
        `[Azure Syntax Highlighter] Found ${lines.length} elements with selector "${selector}"`,
      )
      // Filter out sidebar elements and process
      const validLines = Array.from(lines).filter((line) => !isInSidebar(line))
      console.log(
        `[Azure Syntax Highlighter] ${validLines.length} lines after filtering out sidebar`,
      )
      totalFound += validLines.length
      validLines.forEach((line) => highlightCodeLine(line, language))
    }
  }

  if (totalFound === 0) {
    console.log('[Azure Syntax Highlighter] No code lines found. Looking for Monaco editors...')
    const monacoEditors = document.querySelectorAll('.monaco-editor')
    console.log(
      `[Azure Syntax Highlighter] Found ${monacoEditors.length} Monaco editors`,
    )
    monacoEditors.forEach((editor, i) => {
      const inSidebar = isInSidebar(editor)
      console.log(
        `[Azure Syntax Highlighter] Editor ${i}: inSidebar=${inSidebar}, classes=${editor.className}`,
      )
    })
  }

  // Update injected styles to apply current font size and line height
  updateInjectedStyles()
}

/**
 * Set up MutationObserver to watch for dynamically loaded content
 */
/**
 * Check if an element is code-related
 */
function isCodeRelatedElement(element: Element): boolean {
  return (
    element.classList?.contains('repos-line') ||
    element.classList?.contains('code-line') ||
    element.classList?.contains('view-line') ||
    element.classList?.contains('monaco-editor') ||
    element.classList?.contains('repos-diff-content') ||
    element.classList?.contains('pr-diff-viewer') ||
    element.querySelector?.('.repos-line, .code-line, .diff-line, .view-line, .monaco-editor') !== null
  )
}

/**
 * Check if mutation contains code-related nodes
 */
function hasCodeRelatedNodes(mutation: MutationRecord): boolean {
  for (const node of mutation.addedNodes) {
    if (node instanceof Element && isCodeRelatedElement(node)) {
      return true
    }
  }
  return false
}

function setupObserver(): void {
  const observer = new MutationObserver((mutations) => {
    const shouldProcess = mutations.some(
      (mutation) => mutation.addedNodes.length > 0 && hasCodeRelatedNodes(mutation),
    )

    if (shouldProcess) {
      // Debounce processing
      requestAnimationFrame(() => processCodeLines())
    }
  })

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  })

  console.log('[Azure Syntax Highlighter] Observer started')

  // Set up a separate observer to watch for Monaco style changes and re-apply our backgrounds
  setupMonacoStyleObserver()
}

/**
 * Watch for Monaco editor style changes and re-apply our background colors
 */
function setupMonacoStyleObserver(): void {
  const monacoObserver = new MutationObserver((mutations) => {
    if (!currentSettings.enabled) return

    // Check if any mutation affected our styled editors
    for (const mutation of mutations) {
      if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
        const target = mutation.target as Element
        const editor = target.closest('.monaco-editor.azure-syntax-editor')
        if (editor) {
          // Re-apply our styles
          const themeClass = getThemeClass()
          const backgroundColor = THEME_BACKGROUNDS[themeClass] || null
          const lineColor = THEME_LINE_COLORS[themeClass] || null
          applyMonacoBackground(editor, backgroundColor, lineColor)
        }
      }
    }
  })

  // Observe the entire document for style attribute changes
  monacoObserver.observe(document.body, {
    attributes: true,
    attributeFilter: ['style'],
    subtree: true,
  })

  console.log('[Azure Syntax Highlighter] Monaco style observer started')
}

/**
 * Handle URL changes (SPA navigation) and handle PR file switching
 */
function setupUrlChangeListener(): void {
  let lastUrl = globalThis.location.href
  let lastFileName: string | null = getCurrentFileName()

  const checkUrlChange = (): void => {
    const currentUrl = globalThis.location.href
    const currentFileName = getCurrentFileName()

    // Check if URL changed (back/forward navigation)
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl
      console.log('[Azure Syntax Highlighter] URL changed, reprocessing...')
      // Reset highlighted elements for new page
      setTimeout(() => processCodeLines(), 500)
    } else if (currentFileName !== lastFileName) {
      // File changed within PR view (user selected different file)
      lastFileName = currentFileName
      if (currentFileName) {
        console.log('[Azure Syntax Highlighter] File changed in PR view, reprocessing...')
        setTimeout(() => processCodeLines(), 300)
      }
    }
  }

  // Listen for popstate (back/forward navigation)
  globalThis.addEventListener('popstate', checkUrlChange)

  // Poll for URL and file changes (for SPA navigation)
  setInterval(checkUrlChange, 1000)
}

/**
 * Initialize the content script
 */
async function init(): Promise<void> {
  console.log('[Azure Syntax Highlighter] 🚀 Initializing on:', globalThis.location.href)
  console.log('[Azure Syntax Highlighter] Document readyState:', document.readyState)

  // Load settings
  currentSettings = await getSettings()
  console.log('[Azure Syntax Highlighter] Settings loaded:', currentSettings)

  // Apply initial styles
  updateInjectedStyles()

  // Listen for settings changes
  onSettingsChange((settings) => {
    console.log('[Azure Syntax Highlighter] Settings changed:', settings)
    const themeChanged = currentSettings.theme !== settings.theme
    const enabledChanged = currentSettings.enabled !== settings.enabled
    const fontSizeChanged = currentSettings.fontSize !== settings.fontSize
    currentSettings = settings

    if (enabledChanged) {
      // Toggle visibility of existing highlights
      setHighlightingVisible(settings.enabled)
    }

    if (themeChanged && settings.enabled) {
      // Update theme on all already-highlighted elements
      updateHighlightedThemes()
    }

    if (fontSizeChanged && settings.enabled) {
      // Update font size on all already-highlighted elements
      updateHighlightedFontSize(settings.fontSize)
    }

    // Process new lines if enabled
    if (settings.enabled) {
      processCodeLines()
    }
  })

  // Wait for page to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      console.log('[Azure Syntax Highlighter] DOMContentLoaded fired')
      setupObserver()
      setupUrlChangeListener()
      // Delay initial processing to let Azure DevOps render
      setTimeout(() => {
        console.log('[Azure Syntax Highlighter] Running initial processCodeLines after delay')
        processCodeLines()
      }, 2000)
    })
  } else {
    console.log('[Azure Syntax Highlighter] Document already loaded, setting up...')
    setupObserver()
    setupUrlChangeListener()
    // Delay initial processing to let Azure DevOps finish rendering
    setTimeout(() => {
      console.log('[Azure Syntax Highlighter] Running initial processCodeLines after delay')
      processCodeLines()
    }, 2000)
  }
}

// Start the extension
init()
