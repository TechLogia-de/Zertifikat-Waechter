import { useDarkMode } from '../../hooks/useDarkMode'

/**
 * Compact dark mode toggle button with sun/moon icon.
 * Designed to fit in a sidebar or header.
 */
export default function DarkModeToggle() {
  const { isDark, toggle } = useDarkMode()

  return (
    <button
      onClick={toggle}
      className="group flex items-center justify-center px-3 py-2 text-slate-400 hover:bg-slate-700/50 hover:text-yellow-300 dark:hover:text-yellow-300 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 border border-transparent hover:border-slate-600/30"
      title={isDark ? 'Helles Design' : 'Dunkles Design'}
      aria-label={isDark ? 'Helles Design aktivieren' : 'Dunkles Design aktivieren'}
    >
      {isDark ? (
        // Sun icon - shown in dark mode, click to switch to light
        <svg className="w-5 h-5 group-hover:rotate-45 transition-all duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ) : (
        // Moon icon - shown in light mode, click to switch to dark
        <svg className="w-5 h-5 group-hover:-rotate-12 transition-all duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      )}
    </button>
  )
}
