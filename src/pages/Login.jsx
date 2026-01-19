import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'
import { useNavigate } from 'react-router-dom'
import './Login.css'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark')
  const [showPassword, setShowPassword] = useState(false)
  const [shakeError, setShakeError] = useState(false)
  const [emailValid, setEmailValid] = useState(true)
  const navigate = useNavigate()
  const emailRef = useRef(null)
  const passwordRef = useRef(null)

  const isLight = theme === 'light'
  const isDarker = theme === 'darker'

  // Apply theme to document and save preference
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  // Load saved theme on mount
  useEffect(() => {
    // Check for session
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        navigate('/dashboard')
      }
    })

    // Auto-focus email input
    emailRef.current?.focus()
  }, [navigate])

  // Validate email format
  const validateEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return re.test(email)
  }

  const handleEmailChange = (e) => {
    const value = e.target.value
    setEmail(value)
    if (value) {
      setEmailValid(validateEmail(value))
    } else {
      setEmailValid(true)
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !loading) {
      if (e.target.type === 'email') {
        passwordRef.current?.focus()
      } else if (e.target.type === 'password') {
        handleLogin(e)
      }
    }
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    
    // Validate inputs
    if (!email.trim()) {
      setErrorMessage('Email is required')
      setShakeError(true)
      emailRef.current?.focus()
      setTimeout(() => setShakeError(false), 300)
      return
    }

    if (!validateEmail(email)) {
      setErrorMessage('Please enter a valid email address')
      setShakeError(true)
      emailRef.current?.focus()
      setTimeout(() => setShakeError(false), 300)
      return
    }

    if (!password) {
      setErrorMessage('Password is required')
      setShakeError(true)
      passwordRef.current?.focus()
      setTimeout(() => setShakeError(false), 300)
      return
    }

    setLoading(true)
    setErrorMessage('')
    setSuccessMessage('')

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      })

      if (error) {
        // Enhanced error messages
        switch (error.message) {
          case 'Invalid login credentials':
            setErrorMessage('Invalid email or password. Please try again.')
            break
          case 'Email not confirmed':
            setErrorMessage('Please confirm your email address before logging in.')
            break
          default:
            setErrorMessage(error.message)
        }
        setShakeError(true)
        setTimeout(() => setShakeError(false), 300)
      } else {
        // Show success message before redirect
        setSuccessMessage('Login successful! Redirecting...')
        
        // Add slight delay for UX
        setTimeout(() => {
          navigate('/dashboard')
        }, 800)
      }
    } catch (err) {
      setErrorMessage('An unexpected error occurred. Please try again.')
      setShakeError(true)
      setTimeout(() => setShakeError(false), 300)
    } finally {
      setLoading(false)
    }
  }

  const handleDemoLogin = async () => {
    setEmail('admin@school.com')
    setPassword('demo123')
    setSuccessMessage('Demo credentials filled. Click Sign In to continue.')
  }

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword)
  }

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : prev === 'dark' ? 'darker' : 'light'))
  }

  return (
    <div className={`login-container ${isLight ? 'light-theme' : ''} ${isDarker ? 'darker-theme' : ''}`.trim()}>
      {/* Premium Theme Toggle */}
      <button 
        className="theme-toggle"
        onClick={toggleTheme}
        aria-label="Toggle Theme"
        title={isLight ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
      >
        <svg viewBox="0 0 24 24">
          <path d={!isLight
            ? "M12,18c-3.3,0-6-2.7-6-6s2.7-6,6-6s6,2.7,6,6S15.3,18,12,18zM12,8c-2.2,0-4,1.8-4,4s1.8,4,4,4s4-1.8,4-4S14.2,8,12,8z"
            : "M12,18c-3.3,0-6-2.7-6-6s2.7-6,6-6s6,2.7,6,6S15.3,18,12,18zM12,4.7V12M12,4.7L14.7,7.3M12,4.7L9.3,7.3"
          } />
        </svg>
      </button>

      <div className="login-card">
        <div className="logo-container">
          <img 
            src="/smkkj.png" 
            alt="SMK Khir Johari Logo" 
            className="animated-logo" 
            onError={(e) => {
              e.target.onerror = null
              e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%236366f1'%3E%3Cpath d='M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5'/%3E%3C/svg%3E"
            }}
          />
        </div>

        <h2>Admin Portal</h2>
        <p>Sistem Koperasi SMK Khir Johari</p>

        {/* Demo Credentials Button */}
        <button 
          type="button"
          className="demo-button"
          onClick={handleDemoLogin}
          style={{
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.2)',
            color: 'rgba(255,255,255,0.7)',
            padding: '8px 16px',
            borderRadius: '8px',
            fontSize: '0.85rem',
            marginBottom: '20px',
            cursor: 'pointer',
            transition: 'all 0.3s ease'
          }}
          onMouseEnter={(e) => {
            e.target.style.background = 'rgba(255,255,255,0.1)'
            e.target.style.color = 'white'
          }}
          onMouseLeave={(e) => {
            e.target.style.background = 'transparent'
            e.target.style.color = 'rgba(255,255,255,0.7)'
          }}
        >
          <i className="fas fa-magic" style={{ marginRight: '8px' }}></i>
          Try Demo Credentials
        </button>

        {/* Success Message */}
        {successMessage && (
          <div className="success-message">
            <i className="fas fa-check-circle" style={{ marginRight: '8px' }}></i>
            {successMessage}
          </div>
        )}

        {/* Error Message with animation */}
        {errorMessage && (
          <div className={`error-message ${shakeError ? 'is-shake' : ''}`}>
            <i className="fas fa-exclamation-circle" style={{ marginRight: '8px' }}></i>
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div className="input-group">
            <label>
              <i className="fas fa-envelope" style={{ marginRight: '8px' }}></i>
              Email Address
            </label>
            <input
              ref={emailRef}
              type="email"
              placeholder="admin@school.com"
              required
              value={email}
              onChange={handleEmailChange}
              onKeyPress={handleKeyPress}
              className={!emailValid ? 'invalid' : ''}
              disabled={loading}
              style={{
                borderColor: !emailValid ? 'rgba(239, 68, 68, 0.5)' : undefined,
                background: !emailValid ? 'rgba(239, 68, 68, 0.05)' : undefined
              }}
            />
            {!emailValid && email && (
              <small style={{
                color: '#ef4444',
                fontSize: '0.75rem',
                marginTop: '4px',
                display: 'block'
              }}>
                Please enter a valid email address
              </small>
            )}
          </div>

          <div className="input-group">
            <label>
              <i className="fas fa-lock" style={{ marginRight: '8px' }}></i>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                ref={passwordRef}
                type={showPassword ? "text" : "password"}
                placeholder="********"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={loading}
              />
              <button
                type="button"
                onClick={togglePasswordVisibility}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  color: 'rgba(255,255,255,0.5)',
                  cursor: 'pointer',
                  padding: '4px'
                }}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
              </button>
            </div>
            {password.length > 0 && password.length < 6 && (
              <small style={{
                color: '#f59e0b',
                fontSize: '0.75rem',
                marginTop: '4px',
                display: 'block'
              }}>
                Password must be at least 6 characters
              </small>
            )}
          </div>

          {/* Forgot Password Link */}
          <div style={{
            textAlign: 'right',
            marginBottom: '20px'
          }}>
            <a 
              href="/reset-password" 
              style={{
                color: isLight ? '#6366f1' : 'rgba(99, 102, 241, 0.8)',
                fontSize: '0.85rem',
                textDecoration: 'none',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => e.target.style.opacity = '0.8'}
              onMouseLeave={(e) => e.target.style.opacity = '1'}
            >
              <i className="fas fa-key" style={{ marginRight: '6px' }}></i>
              Forgot Password?
            </a>
          </div>

          <button 
            type="submit" 
            className={`login-button ${loading ? 'loading' : ''}`}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="button-text">Authenticating...</span>
              </>
            ) : (
              <>
                <i className="fas fa-sign-in-alt" style={{ marginRight: '10px' }}></i>
                Sign In
              </>
            )}
          </button>
        </form>

        {/* Additional Info */}
        <div style={{
          marginTop: '30px',
          padding: '15px',
          background: isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.05)',
          borderRadius: '12px',
          fontSize: '0.8rem',
          color: isLight ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)'
        }}>
          <p style={{ margin: '0 0 8px 0' }}>
            <i className="fas fa-info-circle" style={{ marginRight: '8px' }}></i>
            <strong>Access Restricted:</strong> Admin privileges required
          </p>
          <p style={{ margin: 0, fontSize: '0.75rem' }}>
            Contact system administrator for account creation
          </p>
        </div>

        <footer className="login-footer">
          <p style={{ 
            fontSize: '0.75rem',
            marginTop: '25px',
            opacity: 0.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}>
            <i className="fas fa-shield-alt"></i>
            (c) {new Date().getFullYear()} Hak Cipta Terpelihara - Sistem Koperasi SMK Khir Johari
          </p>
        </footer>
      </div>

      {/* Keyboard Shortcuts Info */}
      <div style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        background: isLight ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.3)',
        backdropFilter: 'blur(10px)',
        borderRadius: '8px',
        padding: '10px 15px',
        fontSize: '0.75rem',
        color: isLight ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)',
        border: `1px solid ${isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'}`,
        display: 'none' /* Hide by default, show on hover? */
      }}>
        <div><kbd>Tab</kbd> Navigate - <kbd>Enter</kbd> Submit</div>
      </div>
    </div>
  )
}
