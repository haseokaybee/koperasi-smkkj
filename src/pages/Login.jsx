import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { useNavigate } from 'react-router-dom'
import './Login.css'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const navigate = useNavigate()

  // Redirect if already logged in
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        navigate('/dashboard')
      }
    })
  }, [navigate])

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setErrorMessage('')

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password
    })

    if (error) {
      setErrorMessage(error.message)
    } else {
      navigate('/dashboard')
    }

    setLoading(false)
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="logo-container">
          <img src="/smkkj.png" alt="Logo" className="animated-logo" />
        </div>

        <h2>Admin Login</h2>
        <p>Sistem Koperasi SMK Khir Johari</p>

        {errorMessage && (
          <div className="error-message">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div className="input-group">
            <label>Email Address</label>
            <input
              type="email"
              placeholder="admin@school.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="input-group">
            <label>Password</label>
            <input
              type="password"
              placeholder="••••••••"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button type="submit" className="login-button" disabled={loading}>
            {loading ? 'Authenticating…' : 'Sign In'}
          </button>
        </form>

        <footer
          className="login-footer"
          style={{ marginTop: '25px', opacity: 0.5, textAlign: 'center' }}
        >
          <p style={{ fontSize: '0.8rem' }}>© 2026 Hak Cipta Terpelihara</p>
        </footer>
      </div>
    </div>
  )
}
