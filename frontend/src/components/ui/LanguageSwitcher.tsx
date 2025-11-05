import { motion, AnimatePresence } from 'framer-motion'
import { Globe } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useLanguage } from '../../contexts/LanguageContext'

export default function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [isOpen])

  const languages = [
    { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
    { code: 'en', label: 'English', flag: '🇬🇧' },
  ]

  const currentLanguage = languages.find((lang) => lang.code === language)

  return (
    <div className="relative" ref={dropdownRef}>
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 bg-white/80 backdrop-blur-lg rounded-lg border border-gray-200 hover:border-blue-400 transition-all shadow-sm"
      >
        <Globe className="w-4 h-4 text-gray-600" />
        <span className="text-sm font-medium text-gray-700">{currentLanguage?.flag}</span>
        <motion.svg
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="w-4 h-4 text-gray-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </motion.svg>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-50"
          >
            {languages.map((lang) => (
              <motion.button
                key={lang.code}
                whileHover={{ backgroundColor: 'rgba(59, 130, 246, 0.1)' }}
                onClick={() => {
                  setLanguage(lang.code as 'de' | 'en')
                  setIsOpen(false)
                }}
                className={`w-full flex items-center space-x-3 px-4 py-3 text-left transition-colors ${
                  language === lang.code ? 'bg-blue-50' : ''
                }`}
              >
                <span className="text-2xl">{lang.flag}</span>
                <span className="text-sm font-medium text-gray-700">{lang.label}</span>
                {language === lang.code && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="ml-auto w-2 h-2 bg-blue-600 rounded-full"
                  />
                )}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
