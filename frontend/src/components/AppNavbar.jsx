import { useState, useEffect } from 'react'
import { Container, Navbar, Nav, Button, Badge, Dropdown } from 'react-bootstrap'
import { Link, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { API_BASE_URL } from '../config'

export default function AppNavbar({ user, setUser, children }) {
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState([])

  useEffect(() => {
    if (user && (user.role === 'Admin' || user.role === 'Manager')) {
      fetchNotifications()
      const interval = setInterval(fetchNotifications, 10000) // Poll every 10s
      return () => clearInterval(interval)
    }
  }, [user])

  const fetchNotifications = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/notifications`, {
        headers: { Authorization: `Bearer ${user.token}` }
      })
      setNotifications(res.data)
    } catch (err) {
      console.error('Error fetching notifications', err)
    }
  }

  const markAsRead = async (id) => {
    try {
      await axios.put(`${API_BASE_URL}/api/notifications/${id}/read`, {}, {
        headers: { Authorization: `Bearer ${user.token}` }
      })
      setNotifications(notifications.filter(n => n.id !== id))
    } catch (err) {
      console.error(err)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('role')
    localStorage.removeItem('username')
    setUser(null)
    navigate('/login')
  }

  return (
    <Navbar className="custom-navbar" variant="dark" expand="lg">
      <Container fluid>
        <Navbar.Brand as={Link} to="/dashboard" className="d-flex align-items-center">
          <img src="/logo.png" alt="Logo" style={{ width: '45px', height: '45px', objectFit: 'contain', borderRadius: '8px', marginRight: '12px', backgroundColor: 'white', padding: '2px' }} />
          <span style={{ fontWeight: 800, letterSpacing: '0.5px', fontSize: '1.2rem' }}>Data Analysis Dashboard</span>
        </Navbar.Brand>
        <Nav className="me-auto">
          <Nav.Link as={Link} to="/dashboard">Home</Nav.Link>
          {user.permissions?.includes('can_upload_data') && <Nav.Link as={Link} to="/upload">Upload Data</Nav.Link>}
          {user.permissions?.includes('can_manage_users') && <Nav.Link as={Link} to="/users">Manage Users</Nav.Link>}
        </Nav>
        
        {/* Child elements like the Dashboard Dataset Selector */}
        {children}

        {/* Notifications */}
        {(user.role === 'Admin' || user.role === 'Manager') && (
          <Dropdown align="end" className="me-3">
            <Dropdown.Toggle variant="link" id="dropdown-notifications" className="text-white" style={{ position: 'relative' }}>
              <span style={{ fontSize: '1.2rem' }}>🔔</span>
              {notifications.length > 0 && (
                <Badge bg="danger" pill style={{ position: 'absolute', top: 0, right: 0, transform: 'translate(25%, -25%)' }}>
                  {notifications.length}
                </Badge>
              )}
            </Dropdown.Toggle>
            <Dropdown.Menu className="dropdown-menu-dark" style={{ minWidth: '300px', maxHeight: '400px', overflowY: 'auto' }}>
              <Dropdown.Header>Notifications</Dropdown.Header>
              {notifications.length === 0 ? (
                <Dropdown.ItemText className="text-muted">No new notifications</Dropdown.ItemText>
              ) : (
                notifications.map(n => (
                  <Dropdown.Item key={n.id} onClick={() => markAsRead(n.id)}>
                    <div className="d-flex justify-content-between align-items-start">
                      <span style={{ whiteSpace: 'normal', fontSize: '0.9rem' }}>{n.message}</span>
                    </div>
                    <small className="text-muted">{new Date(n.timestamp).toLocaleTimeString()}</small>
                  </Dropdown.Item>
                ))
              )}
            </Dropdown.Menu>
          </Dropdown>
        )}
        
        <Navbar.Text className="me-3">
          Signed in as: <span className="fw-bold text-info">{user.username}</span> <span className="text-muted">({user.role})</span>
        </Navbar.Text>
        <Button variant="outline-primary" size="sm" onClick={handleLogout}>Logout</Button>
      </Container>
    </Navbar>
  )
}
