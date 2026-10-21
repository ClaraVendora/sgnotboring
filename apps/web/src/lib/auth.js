export function authErrorMessage(error) {
  if (error?.status === 429 || error?.code?.includes('rate_limit')) {
    return 'Too many attempts. Please wait a moment and try again.'
  }
  switch (error?.code) {
    case 'invalid_credentials':
      return 'Email or password is incorrect. Please try again.'
    case 'email_not_confirmed':
      return 'Confirm your email before logging in. You can resend the confirmation below.'
    case 'user_already_exists':
    case 'email_exists':
      return 'This email is already registered. Please log in instead.'
    case 'weak_password':
      return 'Choose a stronger password with at least 8 characters.'
    case 'otp_expired':
    case 'access_denied':
      return 'This confirmation link is invalid or expired. Request a new one below.'
    case 'signup_disabled':
      return 'Sign up is currently unavailable. Please try again later.'
    case 'auth_not_configured':
      return 'Account services are unavailable. You can still browse places.'
    default:
      return 'Could not complete this request. Check your connection and try again.'
  }
}

export function validateCredentials({ email, password, displayName }, signingUp) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Enter a valid email address.'
  if (!password) return 'Enter your password.'
  if (signingUp && password.length < 8) return 'Use at least 8 characters for your password.'
  if (signingUp && displayName.trim().length > 60) return 'Use at most 60 characters for your name.'
  return null
}
