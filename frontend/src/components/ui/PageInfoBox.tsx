import { useState } from 'react'

interface PageInfoBoxProps {
  title: string
  children: React.ReactNode
  variant?: 'info' | 'tip' | 'warning'
  collapsible?: boolean
  defaultOpen?: boolean
}

const variantStyles = {
  info: {
    bg: 'bg-blue-50 border-blue-200',
    icon: 'bg-blue-100 text-blue-600',
    title: 'text-blue-900',
    text: 'text-blue-800',
    iconChar: 'i',
  },
  tip: {
    bg: 'bg-emerald-50 border-emerald-200',
    icon: 'bg-emerald-100 text-emerald-600',
    title: 'text-emerald-900',
    text: 'text-emerald-800',
    iconChar: '?',
  },
  warning: {
    bg: 'bg-amber-50 border-amber-200',
    icon: 'bg-amber-100 text-amber-600',
    title: 'text-amber-900',
    text: 'text-amber-800',
    iconChar: '!',
  },
}

export default function PageInfoBox({ title, children, variant = 'info', collapsible = true, defaultOpen = false }: PageInfoBoxProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const styles = variantStyles[variant]

  return (
    <div className={`rounded-xl border ${styles.bg} overflow-hidden`}>
      <button
        type="button"
        onClick={() => collapsible && setIsOpen(!isOpen)}
        className={`w-full flex items-center gap-3 px-4 py-3 ${collapsible ? 'cursor-pointer hover:opacity-80' : 'cursor-default'} transition-opacity`}
      >
        <div className={`w-7 h-7 rounded-full ${styles.icon} flex items-center justify-center text-sm font-bold flex-shrink-0`}>
          {styles.iconChar}
        </div>
        <span className={`text-sm font-semibold ${styles.title} flex-1 text-left`}>{title}</span>
        {collapsible && (
          <svg
            className={`w-4 h-4 ${styles.title} transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>
      {(isOpen || !collapsible) && (
        <div className={`px-4 pb-4 pt-0 text-sm ${styles.text} leading-relaxed`}>
          {children}
        </div>
      )}
    </div>
  )
}
