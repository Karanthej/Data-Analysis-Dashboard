import { useState, useEffect } from 'react'
import { Container, Card, Form, Button, Alert, ProgressBar, Row, Col, Table, Modal } from 'react-bootstrap'
import { useNavigate, Link } from 'react-router-dom'
import axios from 'axios'
import { API_BASE_URL } from './config'
import AppNavbar from './components/AppNavbar'

export default function UploadData({ user, setUser }) {
  const navigate = useNavigate()
  const [file, setFile] = useState(null)
  const [status, setStatus] = useState('')
  const [assignedLocation, setAssignedLocation] = useState(user.role === 'Admin' ? 'Global' : (user.job_location || 'Global'))
  const [department, setDepartment] = useState(user.role === 'Admin' ? 'Global' : (user.department || 'Global'))
  const [clearanceLevel, setClearanceLevel] = useState(user.role === 'Admin' ? 1 : (user.clearance_level || 1))
  const [uploading, setUploading] = useState(false)
  const [datasets, setDatasets] = useState([])
  const [deleteError, setDeleteError] = useState('')
  
  const [showEditModal, setShowEditModal] = useState(false)
  const [editDatasetId, setEditDatasetId] = useState(null)
  const [editFile, setEditFile] = useState(null)
  const [editUploading, setEditUploading] = useState(false)
  const [editStatus, setEditStatus] = useState('')

  const handleDownload = async (id, name) => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/datasets/${id}/download`, {
        headers: { Authorization: `Bearer ${user.token}` },
        responseType: 'blob'
      })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', name)
      document.body.appendChild(link)
      link.click()
      link.parentNode.removeChild(link)
    } catch (err) {
      setDeleteError('Error downloading dataset')
    }
  }

  const openEditModal = (id) => {
    setEditDatasetId(id)
    setEditFile(null)
    setEditStatus('')
    setShowEditModal(true)
  }

  const handleEditSubmit = async (e) => {
    e.preventDefault()
    if (!editFile) {
      setEditStatus('Please select a file first.')
      return
    }
    const formData = new FormData()
    formData.append('file', editFile)

    setEditUploading(true)
    setEditStatus('')

    try {
      await axios.put(`${API_BASE_URL}/api/datasets/${editDatasetId}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${user.token}`
        }
      })
      setShowEditModal(false)
      fetchDatasets()
    } catch (err) {
      setEditStatus(err.response?.data?.message || 'Error updating dataset')
    }
    setEditUploading(false)
  }

  useEffect(() => {
    fetchDatasets()
  }, [])

  const fetchDatasets = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/datasets`, {
        headers: { Authorization: `Bearer ${user.token}` }
      })
      setDatasets(res.data)
    } catch (err) {
      console.error(err)
    }
  }

  const handleUpload = async (e) => {
    e.preventDefault()
    if (!file) {
      setStatus('Please select a file first.')
      return
    }
    const formData = new FormData()
    formData.append('file', file)
    formData.append('assigned_location', assignedLocation)
    formData.append('department', department)
    formData.append('clearance_level', clearanceLevel)

    setUploading(true)
    setStatus('')

    try {
      const res = await axios.post(`${API_BASE_URL}/api/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${user.token}`
        }
      })
      setStatus('Dataset successfully injected!')
      setFile(null)
      fetchDatasets() // refresh list
    } catch (err) {
      setStatus(err.response?.data?.message || 'Error uploading file')
    }
    setUploading(false)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to permanently delete this dataset?')) return
    setDeleteError('')
    try {
      await axios.delete(`${API_BASE_URL}/api/datasets/${id}`, {
        headers: { Authorization: `Bearer ${user.token}` }
      })
      fetchDatasets()
    } catch (err) {
      setDeleteError(err.response?.data?.message || 'Error deleting dataset')
    }
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
        <AppNavbar user={user} setUser={setUser} />

        <Container className="mt-5">
          <Row>
            {/* Upload Form */}
            <Col md={5} className="mb-4">
              <Card className="glass-card">
                <Card.Body>
                  <Card.Title className="fs-3 fw-bold mb-3">Upload Data <span className="text-gradient">Engine</span></Card.Title>
                  <Card.Text className="text-muted">
                    Securely inject new enterprise datasets (.csv, .xlsx) into the analytical engine.
                  </Card.Text>
                  {status && <Alert variant={status.includes('success') ? 'success' : 'danger'}>{status}</Alert>}
                  <Form onSubmit={handleUpload}>
                    <Form.Group className="mb-4">
                      <Form.Label>Select CSV/Excel File</Form.Label>
                      <Form.Control type="file" onChange={e => setFile(e.target.files[0])} accept=".csv, .xlsx, .xls" />
                    </Form.Group>
                    <Form.Group className="mb-4">
                      <Form.Label>Target Location / Branch</Form.Label>
                      <Form.Control type="text" value={assignedLocation} onChange={e => setAssignedLocation(e.target.value)} required placeholder="e.g. New York, Global" disabled={user.role !== 'Admin'} />
                    </Form.Group>
                    <Form.Group className="mb-4">
                      <Form.Label>Department</Form.Label>
                      <Form.Control type="text" value={department} onChange={e => setDepartment(e.target.value)} required placeholder="e.g. Finance, Global" disabled={user.role !== 'Admin'} />
                    </Form.Group>
                    <Form.Group className="mb-4">
                      <Form.Label>Clearance Level (1-5)</Form.Label>
                      <Form.Control type="number" min="1" max="5" value={clearanceLevel} onChange={e => setClearanceLevel(parseInt(e.target.value))} required disabled={user.role !== 'Admin'} />
                    </Form.Group>
                    <Button variant="primary" type="submit" className="w-100" disabled={uploading}>
                      {uploading ? 'Processing...' : 'Inject Data →'}
                    </Button>
                    {uploading && <ProgressBar animated now={100} className="mt-3" variant="info" />}
                  </Form>
                </Card.Body>
              </Card>
            </Col>
            
            {/* Manage Datasets List */}
            <Col md={7}>
              <Card className="glass-card">
                <Card.Body>
                  <Card.Title className="fs-3 fw-bold mb-3">Manage <span className="text-gradient">Datasets</span></Card.Title>
                  <Card.Text className="text-muted">
                    View and permanently delete datasets stored on the server.
                  </Card.Text>
                  {deleteError && <Alert variant="danger">{deleteError}</Alert>}
                  
                  <Table responsive className="table-borderless mt-4" style={{ color: 'var(--text-primary)' }}>
                    <thead style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <tr>
                        <th>ID</th>
                        <th>Dataset Name</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {datasets.map((d) => (
                        <tr key={d.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td>{d.id}</td>
                          <td>{d.name}</td>
                          <td>
                            <div className="d-flex gap-2">
                              {user.permissions?.includes('can_download_data') && (
                                <Button 
                                  variant="outline-success" 
                                  size="sm" 
                                  onClick={() => handleDownload(d.id, d.name)}
                                >
                                  Download
                                </Button>
                              )}
                              {user.permissions?.includes('can_edit_data') && (
                                <Button 
                                  variant="outline-info" 
                                  size="sm" 
                                  onClick={() => openEditModal(d.id)}
                                >
                                  Replace
                                </Button>
                              )}
                              {user.permissions?.includes('can_delete_data') && (
                                <Button 
                                  variant="danger" 
                                  size="sm" 
                                  onClick={() => handleDelete(d.id)}
                                  style={{ background: 'transparent', border: '1px solid #ef4444', color: '#ef4444' }}
                                >
                                  Delete
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {datasets.length === 0 && (
                        <tr>
                          <td colSpan="3" className="text-center text-muted py-3">No datasets uploaded yet.</td>
                        </tr>
                      )}
                    </tbody>
                  </Table>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Container>
      </div>

      {/* Edit Dataset Modal */}
      <Modal show={showEditModal} onHide={() => setShowEditModal(false)} centered>
        <Modal.Header closeButton className="bg-dark text-white border-bottom-0">
          <Modal.Title>Replace Dataset File</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleEditSubmit}>
          <Modal.Body className="bg-dark text-white">
            {editStatus && <Alert variant="danger">{editStatus}</Alert>}
            <Form.Group className="mb-3">
              <Form.Label>Select New CSV/Excel File</Form.Label>
              <Form.Control type="file" onChange={e => setEditFile(e.target.files[0])} accept=".csv, .xlsx, .xls" required />
            </Form.Group>
            {editUploading && <ProgressBar animated now={100} variant="info" className="mt-2" />}
          </Modal.Body>
          <Modal.Footer className="bg-dark border-top-0">
            <Button variant="secondary" onClick={() => setShowEditModal(false)}>Cancel</Button>
            <Button variant="primary" type="submit" disabled={editUploading}>
              {editUploading ? 'Uploading...' : 'Save & Replace'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

    </div>
  )
}
