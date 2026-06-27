import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Form, Button, Container, Row, Col, Card } from 'react-bootstrap'
import axios from 'axios'
import { API_BASE_URL } from './config'

export default function Login({ setUser }) {
  const [isLogin, setIsLogin] = useState(true)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccessMsg('')
    try {
      if (isLogin) {
        const res = await axios.post(`${API_BASE_URL}/api/login`, { username, password })
        localStorage.setItem('token', res.data.token)
        localStorage.setItem('role', res.data.role)
        localStorage.setItem('username', res.data.username)
        localStorage.setItem('permissions', JSON.stringify(res.data.permissions))
        localStorage.setItem('department', res.data.department || '')
        localStorage.setItem('clearance_level', res.data.clearance_level || 1)
        setUser({ 
          token: res.data.token, 
          role: res.data.role, 
          username: res.data.username,
          permissions: res.data.permissions,
          department: res.data.department,
          clearance_level: res.data.clearance_level
        })
        navigate('/dashboard')
      } else {
        await axios.post(`${API_BASE_URL}/api/signup`, { username, password })
        
        // Auto-login after successful signup
        const res = await axios.post(`${API_BASE_URL}/api/login`, { username, password })
        localStorage.setItem('token', res.data.token)
        localStorage.setItem('role', res.data.role)
        localStorage.setItem('username', res.data.username)
        localStorage.setItem('permissions', JSON.stringify(res.data.permissions))
        localStorage.setItem('department', res.data.department || '')
        localStorage.setItem('clearance_level', res.data.clearance_level || 1)
        setUser({ 
          token: res.data.token, 
          role: res.data.role, 
          username: res.data.username,
          permissions: res.data.permissions,
          department: res.data.department,
          clearance_level: res.data.clearance_level
        })
        navigate('/dashboard')
      }
    } catch (err) {
      if (!err.response) {
        setError(`Cannot connect: ${err.message}`)
      } else {
        const status = err.response.status
        const data = err.response.data
        const msg = data?.message || (typeof data === 'string' ? data.substring(0, 50) : JSON.stringify(data))
        setError(`Error ${status}: ${msg}`)
      }
    }
    setLoading(false)
  }

  return (
    <div style={{ position: 'relative', overflow: 'hidden', minHeight: '100vh', display: 'flex', alignItems: 'center' }}>
      {/* Background Floating Elements */}
      <img 
        src="/floating_discs.png" 
        alt="3D Floating Discs" 
        style={{
          position: 'absolute',
          top: '5%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '80%',
          maxWidth: '1000px',
          opacity: 0.8,
          zIndex: 0,
          pointerEvents: 'none'
        }}
      />
      
      <Container style={{ zIndex: 1, position: 'relative' }}>
        <Row className="justify-content-center text-center mb-5">
          <Col md={10}>
            <h1 style={{ fontSize: '4.5rem', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1 }}>
              Power <span className="text-gradient">Universal Analytics</span> <br/>With Your Data
            </h1>
            <p className="mt-4" style={{ color: 'var(--text-secondary)', fontSize: '1.2rem', maxWidth: '600px', margin: '0 auto' }}>
              Make the best decisions with automated insights. Our Data Engine leverages your enterprise data safely and seamlessly unlocks the value of AI.
            </p>
          </Col>
        </Row>

        <Row className="justify-content-center">
          <Col md={5} lg={4}>
            <Card className="glass-card p-4" style={{ background: 'rgba(5, 5, 5, 0.7) !important' }}>
              <Card.Body>
                <div className="text-center mb-4">
                  <h3 style={{ fontWeight: 700, color: 'white' }}>
                    {isLogin ? 'Welcome Back' : 'Create Account'}
                  </h3>
                </div>
                {error && <div className="alert alert-danger py-2" style={{ background: 'rgba(220, 53, 69, 0.1)', color: '#ff6b6b', border: '1px solid rgba(220,53,69,0.3)', fontSize: '0.9rem' }}>{error}</div>}
                {successMsg && <div className="alert alert-success py-2" style={{ background: 'rgba(25, 135, 84, 0.1)', color: '#4ade80', border: '1px solid rgba(25,135,84,0.3)', fontSize: '0.9rem' }}>{successMsg}</div>}
                
                <Form onSubmit={handleSubmit}>
                  <Form.Group className="mb-3">
                    <Form.Label>Username</Form.Label>
                    <Form.Control type="text" value={username} onChange={e => setUsername(e.target.value)} required placeholder="Enter your username" />
                  </Form.Group>
                  <Form.Group className="mb-4">
                    <Form.Label>Password</Form.Label>
                    <Form.Control type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" />
                  </Form.Group>
                  <Button variant="primary" type="submit" className="w-100 mb-3" disabled={loading} style={{ padding: '0.75rem' }}>
                    {loading ? 'Processing...' : (isLogin ? 'Sign In →' : 'Sign Up →')}
                  </Button>
                </Form>
                
                <div className="text-center mt-2">
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    {isLogin ? "Don't have an account? " : "Already have an account? "}
                  </span>
                  <span 
                    style={{ color: 'var(--accent-blue)', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }} 
                    onClick={() => { setIsLogin(!isLogin); setError(''); setSuccessMsg(''); }}
                  >
                    {isLogin ? 'Sign Up' : 'Log In'}
                  </span>
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
    </div>
  )
}
