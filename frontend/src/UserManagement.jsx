import { useState, useEffect } from 'react'
import { Container, Navbar, Nav, Card, Table, Button, Alert, Form, Row, Col } from 'react-bootstrap'
import { useNavigate, Link } from 'react-router-dom'
import axios from 'axios'
import { API_BASE_URL } from './config'

export default function UserManagement({ user, setUser }) {
  const navigate = useNavigate()
  const [users, setUsers] = useState([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  // New User Form State
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState('User')
  const [newJobRole, setNewJobRole] = useState('Analyst')
  const [newJobLocation, setNewJobLocation] = useState('Global')
  const [newDepartment, setNewDepartment] = useState('Global')
  const [newClearanceLevel, setNewClearanceLevel] = useState(1)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/users`, {
        headers: { Authorization: `Bearer ${user.token}` }
      })
      setUsers(res.data)
    } catch (err) {
      console.error(err)
      setError('Failed to fetch users.')
    }
  }

  const handleDelete = async (userId) => {
    if (!window.confirm("Are you sure you want to revoke this user's access?")) return;
    try {
      await axios.delete(`${API_BASE_URL}/api/users/${userId}`, {
        headers: { Authorization: `Bearer ${user.token}` }
      })
      fetchUsers()
      setSuccess('User successfully removed.')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err.response?.data?.message || 'Error deleting user')
      setTimeout(() => setError(''), 3000)
    }
  }

  const handleCreateUser = async (e) => {
    e.preventDefault()
    setCreating(true)
    setError('')
    setSuccess('')
    try {
      await axios.post(`${API_BASE_URL}/api/users`, {
        username: newUsername,
        password: newPassword,
        role: newRole,
        job_role: newJobRole,
        job_location: newJobLocation,
        department: newDepartment,
        clearance_level: newClearanceLevel
      }, {
        headers: { Authorization: `Bearer ${user.token}` }
      })
      fetchUsers()
      setSuccess(`User ${newUsername} created successfully.`)
      setNewUsername('')
      setNewPassword('')
      setNewRole('User')
      setNewJobRole('Analyst')
      setNewJobLocation('Global')
      setNewDepartment('Global')
      setNewClearanceLevel(1)
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err.response?.data?.message || 'Error creating user')
      setTimeout(() => setError(''), 3000)
    }
    setCreating(false)
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('role')
    setUser(null)
    navigate('/login')
  }

  return (
    <div style={{ position: 'relative', minHeight: '100vh', overflowX: 'hidden' }}>
      {/* Background Floating Elements */}
      <img 
        src="/floating_discs.png" 
        alt="3D Floating Discs" 
        style={{
          position: 'absolute',
          top: '-10%',
          right: '-10%',
          width: '60%',
          maxWidth: '800px',
          opacity: 0.3,
          zIndex: 0,
          pointerEvents: 'none',
          transform: 'rotate(15deg)'
        }}
      />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <Navbar className="custom-navbar" variant="dark" expand="lg">
          <Container fluid>
            <Navbar.Brand href="#" className="d-flex align-items-center">
              <img src="/logo.png" alt="Logo" style={{ width: '45px', height: '45px', objectFit: 'contain', borderRadius: '8px', marginRight: '12px', backgroundColor: 'white', padding: '2px' }} />
              <span style={{ fontWeight: 800, letterSpacing: '0.5px', fontSize: '1.2rem' }}>Data Analysis Dashboard</span>
            </Navbar.Brand>
            <Nav className="me-auto">
              <Nav.Link as={Link} to="/dashboard">Home</Nav.Link>
              {user.permissions?.includes('can_upload_data') && <Nav.Link as={Link} to="/upload">Upload Data</Nav.Link>}
              {user.permissions?.includes('can_manage_users') && <Nav.Link as={Link} to="/users">Manage Users</Nav.Link>}
            </Nav>
            <Navbar.Text className="me-3">
              Signed in as: <span className="fw-bold text-info">{user.username}</span> <span className="text-muted">({user.role})</span>
            </Navbar.Text>
            <Button variant="outline-primary" size="sm" onClick={handleLogout}>Logout</Button>
          </Container>
        </Navbar>

        <Container className="mt-5">
          <Row>
            {/* User List Panel */}
            <Col md={8}>
              <Card className="glass-card mb-4">
                <Card.Body>
                  <Card.Title className="fs-3 fw-bold mb-3">Enterprise <span className="text-gradient">Access Control</span></Card.Title>
                  <Card.Text className="text-muted">
                    Admin interface to securely manage platform access.
                  </Card.Text>
                  {error && <Alert variant="danger">{error}</Alert>}
                  {success && <Alert variant="success">{success}</Alert>}
                  
                  <Table responsive className="table-borderless mt-4" style={{ color: 'var(--text-primary)' }}>
                    <thead style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <tr>
                        <th>ID</th>
                        <th>Username</th>
                        <th>Access Level</th>
                        <th>Job Role</th>
                        <th>Location</th>
                        <th>Dept</th>
                        <th>Clearance</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td>{u.id}</td>
                          <td>{u.username}</td>
                          <td>
                            <span className={`badge bg-${u.role === 'Admin' ? 'primary' : u.role === 'Manager' ? 'warning text-dark' : 'secondary'}`} style={{boxShadow: u.role === 'Admin' ? '0 0 10px rgba(59, 130, 246, 0.5)' : u.role === 'Manager' ? '0 0 10px rgba(245, 158, 11, 0.5)' : 'none'}}>
                              {u.role}
                            </span>
                          </td>
                          <td>{u.job_role || '-'}</td>
                          <td>{u.job_location || '-'}</td>
                          <td>{u.department || '-'}</td>
                          <td>{u.clearance_level || 1}</td>
                          <td>
                            <Button 
                              variant="danger" 
                              size="sm" 
                              disabled={u.username === user.username} // Can't delete self
                              onClick={() => handleDelete(u.id)}
                              style={{ background: 'transparent', border: '1px solid #ef4444', color: '#ef4444' }}
                            >
                              Revoke Access
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </Card.Body>
              </Card>
            </Col>
            
            {/* Add User Panel */}
            <Col md={4}>
              <Card className="glass-card">
                <Card.Body>
                  <Card.Title className="fs-5 fw-bold mb-3">Add <span className="text-gradient">New User</span></Card.Title>
                  <Form onSubmit={handleCreateUser}>
                    <Form.Group className="mb-3">
                      <Form.Label>Username</Form.Label>
                      <Form.Control type="text" value={newUsername} onChange={e => setNewUsername(e.target.value)} required placeholder="Enter username" />
                    </Form.Group>
                    <Form.Group className="mb-3">
                      <Form.Label>Password</Form.Label>
                      <Form.Control type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required placeholder="••••••••" />
                    </Form.Group>
                    <Form.Group className="mb-3">
                      <Form.Label>Job Title / Role</Form.Label>
                      <Form.Control type="text" value={newJobRole} onChange={e => setNewJobRole(e.target.value)} required placeholder="e.g. Sales Analyst" />
                    </Form.Group>
                    <Form.Group className="mb-3">
                      <Form.Label>Location / Branch</Form.Label>
                      <Form.Control type="text" value={newJobLocation} onChange={e => setNewJobLocation(e.target.value)} required placeholder="e.g. New York, Remote" />
                    </Form.Group>
                    <Form.Group className="mb-3">
                      <Form.Label>Department</Form.Label>
                      <Form.Control type="text" value={newDepartment} onChange={e => setNewDepartment(e.target.value)} required placeholder="e.g. Finance, Global" />
                    </Form.Group>
                    <Form.Group className="mb-3">
                      <Form.Label>Clearance Level (1-5)</Form.Label>
                      <Form.Control type="number" min="1" max="5" value={newClearanceLevel} onChange={e => setNewClearanceLevel(parseInt(e.target.value))} required />
                    </Form.Group>
                    <Form.Group className="mb-4">
                      <Form.Label>Platform Access Level</Form.Label>
                      <Form.Select 
                        value={newRole} 
                        onChange={e => setNewRole(e.target.value)}
                        style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)', color: 'white', border: '1px solid var(--border-color)' }}
                      >
                        <option value="User">User</option>
                        <option value="Auditor">Auditor</option>
                        <option value="Data Engineer">Data Engineer</option>
                        <option value="Manager">Manager</option>
                        <option value="Admin">Admin</option>
                      </Form.Select>
                    </Form.Group>
                    <Button variant="primary" type="submit" className="w-100" disabled={creating}>
                      {creating ? 'Creating...' : 'Grant Access →'}
                    </Button>
                  </Form>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Container>
      </div>
    </div>
  )
}
