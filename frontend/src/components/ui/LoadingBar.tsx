import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'

export default function LoadingBar() {
  const location = useLocation()
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    // Start loading animation bei Route-Change
    setLoading(true)
    setProgress(0)

    // Simuliere Ladefortschritt
    const timer1 = setTimeout(() => setProgress(30), 50)
    const timer2 = setTimeout(() => setProgress(60), 150)
    const timer3 = setTimeout(() => setProgress(90), 250)
    
    // Complete nach kurzer Zeit
    const completeTimer = setTimeout(() => {
      setProgress(100)
      setTimeout(() => {
        setLoading(false)
        setProgress(0)
      }, 200)
    }, 300)

    return () => {
      clearTimeout(timer1)
      clearTimeout(timer2)
      clearTimeout(timer3)
      clearTimeout(completeTimer)
    }
  }, [location.pathname])

  if (!loading || progress === 0) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[100]">
      <div 
        className="h-1 bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-300 ease-out shadow-lg"
        style={{ 
          width: `${progress}%`,
          boxShadow: '0 0 10px rgba(59, 130, 246, 0.5)'
        }}
      />
    </div>
  )
}

