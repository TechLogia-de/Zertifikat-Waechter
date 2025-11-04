/**
 * Application Constants
 * Zentrale Konfiguration für die gesamte Anwendung
 */

// Environment Detection
export const IS_DEVELOPMENT = import.meta.env.DEV
export const IS_PRODUCTION = import.meta.env.PROD
export const IS_TEST = import.meta.env.MODE === 'test'

// Security Constants
export const SECURITY = {
  // Session Timeout (in milliseconds)
  SESSION_TIMEOUT: 8000,
  
  // Retry Configuration
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000,
  
  // Token Configuration
  TOKEN_REFRESH_INTERVAL: 3600000, // 1 hour
  
  // Rate Limiting (Frontend)
  MAX_LOGIN_ATTEMPTS: 5,
  LOGIN_COOLDOWN: 300000, // 5 minutes
} as const

// Logging Configuration
export const LOGGING = {
  // In Production: Nur Errors und Warnings
  LEVEL: IS_PRODUCTION ? 'error' : 'debug',
  
  // Privacy: Mask sensitive data in Production
  MASK_EMAILS: IS_PRODUCTION,
  MASK_USER_IDS: IS_PRODUCTION,
  
  // Include stack traces only in Development
  INCLUDE_STACK_TRACES: IS_DEVELOPMENT,
} as const

// API Configuration
export const API = {
  // Timeouts
  DEFAULT_TIMEOUT: 30000, // 30 seconds
  UPLOAD_TIMEOUT: 120000, // 2 minutes
  
  // Retry Configuration
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000,
} as const

// Validation Rules
export const VALIDATION = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  DOMAIN: /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/,
  PORT: /^([1-9][0-9]{0,3}|[1-5][0-9]{4}|6[0-4][0-9]{3}|65[0-4][0-9]{2}|655[0-2][0-9]|6553[0-5])$/,
  
  // Length constraints
  MAX_EMAIL_LENGTH: 255,
  MAX_DOMAIN_LENGTH: 253,
  MAX_TENANT_NAME_LENGTH: 100,
} as const

// Feature Flags
export const FEATURES = {
  ENABLE_MFA: true,
  ENABLE_OAUTH: true,
  ENABLE_EMAIL_LOGIN: true,
  ENABLE_ACME: true,
  ENABLE_WEBHOOKS: true,
  ENABLE_AGENT_MODE: true,
} as const

// UI Constants
export const UI = {
  // Pagination
  DEFAULT_PAGE_SIZE: 10,
  MAX_PAGE_SIZE: 100,
  
  // Toasts
  TOAST_DURATION: 5000,
  
  // Loading States
  DEBOUNCE_DELAY: 300,
  
  // Charts
  CHART_REFRESH_INTERVAL: 30000, // 30 seconds
} as const

// Export all constants
export default {
  IS_DEVELOPMENT,
  IS_PRODUCTION,
  IS_TEST,
  SECURITY,
  LOGGING,
  API,
  VALIDATION,
  FEATURES,
  UI,
} as const

