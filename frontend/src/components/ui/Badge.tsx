interface BadgeProps {
  variant: 'success' | 'warning' | 'error' | 'info' | 'neutral'
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
  icon?: string
}

export default function Badge({ variant, children, size = 'md', icon }: BadgeProps) {
  const variants = {
    success: {
      bg: '#D1FAE5',
      text: '#065F46',
      border: '#10B981'
    },
    warning: {
      bg: '#FEF3C7',
      text: '#92400E',
      border: '#F59E0B'
    },
    error: {
      bg: '#FEE2E2',
      text: '#991B1B',
      border: '#EF4444'
    },
    info: {
      bg: '#DBEAFE',
      text: '#1E40AF',
      border: '#3B82F6'
    },
    neutral: {
      bg: '#F1F5F9',
      text: '#475569',
      border: '#94A3B8'
    }
  }

  const sizes = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base'
  }

  const style = variants[variant]

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md font-semibold ${sizes[size]}`}
      style={{
        backgroundColor: style.bg,
        color: style.text,
        border: `1px solid ${style.border}40`
      }}
    >
      {icon && <span>{icon}</span>}
      {children}
    </span>
  )
}

