interface LoadingStateProps {
  size?: 'sm' | 'md' | 'lg'
  text?: string
  fullScreen?: boolean
}

export default function LoadingState({ 
  size = 'md', 
  text = 'Wird geladen...', 
  fullScreen = false 
}: LoadingStateProps) {
  const sizes = {
    sm: 'h-8 w-8 border-2',
    md: 'h-12 w-12 border-3',
    lg: 'h-16 w-16 border-4'
  }

  const textSizes = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  }

  const content = (
    <div className="flex flex-col items-center justify-center gap-3">
      {/* Unified Spinner */}
      <div className="relative">
        {/* Outer rotating ring */}
        <div 
          className={`${sizes[size]} rounded-full border-[#E2E8F0] border-t-[#3B82F6] animate-spin`}
        />
        {/* Inner pulsing dot */}
        <div 
          className="absolute inset-0 flex items-center justify-center"
        >
          <div className="w-2 h-2 bg-[#3B82F6] rounded-full animate-pulse" />
        </div>
      </div>
      
      {/* Loading Text */}
      {text && (
        <p className={`${textSizes[size]} text-[#64748B] font-medium animate-pulse`}>
          {text}
        </p>
      )}
    </div>
  )

  if (fullScreen) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        {content}
      </div>
    )
  }

  return content
}

