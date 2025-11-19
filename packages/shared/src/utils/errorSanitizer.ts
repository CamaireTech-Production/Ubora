const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
const URL_REGEX = /https?:\/\/[^\s]+/gi
const SCRIPT_TAG_REGEX = /<script.*?>.*?<\/script>/gi
const HTML_TAG_REGEX = /<[^>]+>/g

const SENSITIVE_KEYWORDS = [
  'password',
  'passcode',
  'token',
  'secret',
  'api key',
  'api-key',
  'access token',
  'refresh token'
]

/**
 * Sanitize error messages before surfacing them to end-users/logs.
 * Removes emails, URLs, script tags and replaces known sensitive keywords by placeholders.
 */
export const sanitizeSensitiveErrorMessage = (message?: string): string => {
  if (!message || typeof message !== 'string') {
    return 'Une erreur est survenue. Veuillez réessayer.'
  }

  let sanitized = message

  sanitized = sanitized.replace(EMAIL_REGEX, '[REDACTED_EMAIL]')
  sanitized = sanitized.replace(URL_REGEX, '[REDACTED_URL]')
  sanitized = sanitized.replace(SCRIPT_TAG_REGEX, '')
  sanitized = sanitized.replace(HTML_TAG_REGEX, '')

  SENSITIVE_KEYWORDS.forEach((keyword) => {
    const regex = new RegExp(keyword, 'gi')
    sanitized = sanitized.replace(regex, '[SENSITIVE]')
  })

  sanitized = sanitized.replace(/no user record found.*$/i, 'Compte introuvable')
  sanitized = sanitized.replace(/\s+/g, ' ').trim()

  if (!sanitized) {
    return 'Une erreur est survenue. Veuillez réessayer.'
  }

  return sanitized
}

