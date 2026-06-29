import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Container, Row, Col, Card, Button, Form, Modal } from 'react-bootstrap'
import Plot from 'react-plotly.js'
import axios from 'axios'
import { API_BASE_URL } from './config'
import AppNavbar from './components/AppNavbar'

export default function Dashboard({ user, setUser }) {
  const navigate = useNavigate()
  
  const [datasets, setDatasets] = useState([])
  const [selectedDatasetId, setSelectedDatasetId] = useState(null)
  const [uploadingTemp, setUploadingTemp] = useState(false)
  const fileInputRef = useRef(null)
  
  const [insights, setInsights] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  const [availableFilters, setAvailableFilters] = useState([])
  const [selectedFilters, setSelectedFilters] = useState({})
  const [auditModal, setAuditModal] = useState({ show: false, title: '', content: '' })

  const executeAudit = async (actionName, displayTitle) => {
    if (!selectedDatasetId) {
      alert("Please select a dataset first.");
      return;
    }
    setAuditModal({ show: true, title: displayTitle, content: 'Running audit...' })
    try {
      const res = await axios.post(`${API_BASE_URL}/api/audit/${selectedDatasetId}`, { action: actionName }, {
        headers: { Authorization: `Bearer ${user.token}` }
      })
      setAuditModal({ show: true, title: displayTitle, content: res.data.result })
    } catch (err) {
      setAuditModal({ show: true, title: 'Error', content: err.response?.data?.message || 'Failed to execute audit' })
    }
  }

  const handleTempUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    const formData = new FormData()
    formData.append('file', file)

    setUploadingTemp(true)
    setError('')
    try {
      const res = await axios.post(`${API_BASE_URL}/api/upload_temp`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${user.token}`
        }
      })
      const newDataset = { id: res.data.id, name: res.data.name }
      setDatasets(prev => [...prev, newDataset])
      setSelectedDatasetId(res.data.id)
    } catch (err) {
      setError(err.response?.data?.message || 'Error uploading temporary dataset')
    }
    setUploadingTemp(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // 1. Fetch available datasets on load
  useEffect(() => {
    const fetchDatasets = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/datasets`, {
          headers: { Authorization: `Bearer ${user.token}` }
        })
        setDatasets(res.data)
        if (res.data.length > 0) {
          setSelectedDatasetId(res.data[0].id)
        }
      } catch (err) {
        console.error(err)
        if (!err.response) {
          setError(`Failed to fetch datasets: ${err.message}`)
        } else {
          setError(`Failed to fetch datasets (Error ${err.response.status})`)
        }
      }
    }
    fetchDatasets()
  }, [user.token])

  // 1b. Fetch available filters when selectedDatasetId changes
  useEffect(() => {
    if (!selectedDatasetId) return;
    
    const fetchFilters = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/filters/${selectedDatasetId}`, {
          headers: { Authorization: `Bearer ${user.token}` }
        })
        setAvailableFilters(res.data)
        setSelectedFilters({}) // reset filters for new dataset
      } catch (err) {
        console.error("Failed to fetch filters", err)
      }
    }
    fetchFilters()
  }, [selectedDatasetId, user.token])

  // 2. Fetch insights when selectedDatasetId or selectedFilters changes
  useEffect(() => {
    if (!selectedDatasetId) return;
    
    const fetchInsights = async () => {
      setLoading(true)
      setError('')
      try {
        const params = new URLSearchParams()
        Object.keys(selectedFilters).forEach(k => {
          if (selectedFilters[k]) params.append(k, selectedFilters[k])
        })
        const qs = params.toString()
        const url = `${API_BASE_URL}/api/insights/${selectedDatasetId}` + (qs ? `?${qs}` : '')
        
        const res = await axios.get(url, {
          headers: { Authorization: `Bearer ${user.token}` }
        })
        setInsights(res.data)
      } catch (err) {
        console.error(err)
        setError('Failed to fetch dataset insights.')
      }
      setLoading(false)
    }
    fetchInsights()
  }, [selectedDatasetId, user.token, selectedFilters])

  const formatValue = (val) => {
    if (typeof val === 'number') {
      if (val % 1 !== 0) return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      return val.toLocaleString()
    }
    return val
  }

  return (
    <div style={{ position: 'relative', minHeight: '100vh', overflowX: 'hidden' }}>

      <div style={{ position: 'relative', zIndex: 1 }}>
        <AppNavbar user={user} setUser={setUser}>
          <div className="d-flex align-items-center">
            <Form.Select 
              value={selectedDatasetId || ''} 
              onChange={(e) => setSelectedDatasetId(e.target.value)}
              className="w-auto me-3"
              style={{ backgroundColor: 'rgba(15, 23, 42, 0.5)', color: 'white', border: '1px solid var(--border-color)' }}
            >
              {datasets.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </Form.Select>
            <input 
              type="file" 
              accept=".csv, .xlsx, .xls" 
              style={{ display: 'none' }} 
              ref={fileInputRef} 
              onChange={handleTempUpload} 
            />
            <Button 
              variant="outline-info" 
              size="sm" 
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingTemp}
            >
              {uploadingTemp ? 'Uploading...' : 'Upload'}
            </Button>
          </div>
        </AppNavbar>

        <Container fluid className="mt-5 px-4">
          <Row className="mb-4">
            <Col>
              <h2 style={{ fontSize: '2.5rem', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 0 }}>
                Dataset <span className="text-gradient">Insights</span>
              </h2>
              <p style={{ color: 'var(--text-secondary)' }}>Dynamically analyzing your uploaded datasets in real-time.</p>
            </Col>
          </Row>

          {/* Auditor Tools Panel */}
          {user.role === 'Auditor' && (
            <Row className="mb-4">
              <Col>
                <Card className="glass-card" style={{ borderLeft: '4px solid #f59e0b' }}>
                  <Card.Body>
                    <Card.Title className="text-warning fw-bold mb-3">Auditor Control Panel</Card.Title>
                    <div className="d-flex flex-wrap gap-2">
                      {user.permissions?.includes('can_assess_risk') && <Button variant="outline-warning" size="sm" onClick={() => executeAudit('can_assess_risk', 'Risk Assessment')}>Assess risk: Spot weak areas</Button>}
                      {user.permissions?.includes('can_test_controls') && <Button variant="outline-warning" size="sm" onClick={() => executeAudit('can_test_controls', 'Test Controls')}>Test controls: Verify rules work</Button>}
                      {user.permissions?.includes('can_gather_evidence') && <Button variant="outline-warning" size="sm" onClick={() => executeAudit('can_gather_evidence', 'Financial Evidence')}>Gather evidence: Check bank balances</Button>}
                      {user.permissions?.includes('can_verify_accuracy') && <Button variant="outline-warning" size="sm" onClick={() => executeAudit('can_verify_accuracy', 'Verify Accuracy')}>Verify accuracy: Recalculate financial data</Button>}
                      {user.permissions?.includes('can_ensure_compliance') && <Button variant="outline-warning" size="sm" onClick={() => executeAudit('can_ensure_compliance', 'Compliance Check')}>Ensure compliance: Follow current laws</Button>}
                      {user.permissions?.includes('can_issue_opinion') && <Button variant="outline-warning" size="sm" onClick={() => executeAudit('can_issue_opinion', 'Auditor Opinion')}>Issue opinion: Certify data fairness</Button>}
                      {user.permissions?.includes('can_report_findings') && <Button variant="outline-warning" size="sm" onClick={() => executeAudit('can_report_findings', 'Final Report')}>Report findings: Inform company management</Button>}
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          )}

          {/* Dynamic Filters UI */}
          {availableFilters.length > 0 && (
            <Row className="mb-4">
              <Col>
                <div className="d-flex gap-3 align-items-end overflow-auto pb-2" style={{ whiteSpace: 'nowrap' }}>
                  {availableFilters.map(filter => (
                    <div key={filter.column} className="d-flex flex-column">
                      <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: '600', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                        {filter.column}
                      </label>
                      <Form.Select 
                        className="filter-select-red"
                        value={selectedFilters[filter.column] || ''}
                        onChange={(e) => setSelectedFilters({...selectedFilters, [filter.column]: e.target.value})}
                        style={{ minWidth: '200px', width: 'auto', border: '1px solid var(--accent-primary)', fontSize: '1rem' }}
                      >
                        <option value="">All</option>
                        {filter.values.map(v => <option key={v} value={v}>{v}</option>)}
                      </Form.Select>
                    </div>
                  ))}
                  {Object.keys(selectedFilters).some(k => selectedFilters[k] !== '') && (
                    <Button variant="outline-danger" onClick={() => setSelectedFilters({})} style={{ height: 'fit-content', marginBottom: '2px' }}>Clear</Button>
                  )}
                </div>
              </Col>
            </Row>
          )}
          
          {error && <div className="alert alert-danger">{error}</div>}

          {loading && <div className="text-center mt-5"><span className="text-light fs-4">Analyzing dataset...</span></div>}
        
        {!loading && insights && (
          <>
            {/* Dynamic KPIs */}
            <Row className="mb-2 justify-content-center">
              {insights.kpis.map((kpi, idx) => (
                <Col md="auto" key={idx} style={{ flex: '1 1 0', minWidth: '200px' }}>
                  <Card className="text-center glass-card mb-4 h-100">
                    <Card.Body className="d-flex flex-column justify-content-center">
                      <Card.Title className="text-muted" style={{fontSize: '0.9rem'}}>{kpi.title}</Card.Title>
                      <h4 className="mt-2 text-truncate" title={kpi.value}>{formatValue(kpi.value)}</h4>
                    </Card.Body>
                  </Card>
                </Col>
              ))}
            </Row>
            
            {/* Dynamic Charts */}
            <Row>
              <Col md={6}>
                {insights.bar_chart ? (
                  <Card className="glass-card mb-4">
                    <Card.Body>
                      <Card.Title className="text-white fw-bold text-capitalize fs-5">{insights.bar_chart.title}</Card.Title>
                      <div style={{ background: 'transparent', display: 'flex', justifyContent: 'center' }}>
                        <Plot
                          data={[
                            {
                              x: insights.bar_chart.labels,
                              y: insights.bar_chart.values,
                              type: 'bar',
                              marker: {
                                color: insights.bar_chart.values,
                                colorscale: [[0, '#7ED7F7'], [1, '#5A4FD6']]
                              },
                            },
                          ]}
                          layout={{ 
                            width: 550, height: 350, 
                            paper_bgcolor: 'rgba(0,0,0,0)', 
                            plot_bgcolor: 'rgba(0,0,0,0)',
                            font: {color: '#cbd5e1'},
                            xaxis: {gridcolor: 'rgba(255,255,255,0.1)', title: insights.bar_chart.cat_col, tickangle: -45},
                            yaxis: {gridcolor: 'rgba(255,255,255,0.1)', title: insights.bar_chart.num_col},
                            margin: { b: 100 }
                          }}
                          config={{displayModeBar: false}}
                        />
                      </div>
                    </Card.Body>
                  </Card>
                ) : (
                  <Card className="glass-card mb-4"><Card.Body>No bar chart insight generated.</Card.Body></Card>
                )}
              </Col>
              
              <Col md={6}>
                {insights.line_chart ? (
                  <Card className="glass-card mb-4">
                    <Card.Body>
                      <Card.Title className="text-white fw-bold text-capitalize fs-5">{insights.line_chart.title}</Card.Title>
                      <div style={{ background: 'transparent', display: 'flex', justifyContent: 'center' }}>
                        <Plot
                          data={[
                            {
                              x: insights.line_chart.labels,
                              y: insights.line_chart.values,
                              type: 'scatter',
                              mode: 'lines+markers',
                              marker: {color: '#5A4FD6'},
                              line: {color: '#7ED7F7', width: 3}
                            },
                          ]}
                          layout={{ 
                            width: 550, height: 350, 
                            paper_bgcolor: 'rgba(0,0,0,0)', 
                            plot_bgcolor: 'rgba(0,0,0,0)',
                            font: {color: '#cbd5e1'},
                            xaxis: {gridcolor: 'rgba(255,255,255,0.1)', title: insights.line_chart.cat_col, tickangle: -45},
                            yaxis: {gridcolor: 'rgba(255,255,255,0.1)', title: insights.line_chart.num_col},
                            margin: { b: 100 }
                          }}
                          config={{displayModeBar: false}}
                        />
                      </div>
                    </Card.Body>
                  </Card>
                ) : (
                  <Card className="glass-card mb-4"><Card.Body>No line chart insight generated.</Card.Body></Card>
                )}
              </Col>
            </Row>
          </>
        )}
      </Container>
      
      <Modal show={auditModal.show} onHide={() => setAuditModal({...auditModal, show: false})} centered size="lg">
        <Modal.Header closeButton className="bg-dark text-white border-bottom-0">
          <Modal.Title className="text-warning fw-bold">{auditModal.title}</Modal.Title>
        </Modal.Header>
        <Modal.Body className="bg-dark text-white pt-4 pb-4" style={{ whiteSpace: 'pre-line', fontSize: '1.1rem' }}>
          {auditModal.content}
        </Modal.Body>
        <Modal.Footer className="bg-dark border-top-0">
          <Button variant="outline-light" onClick={() => setAuditModal({...auditModal, show: false})}>Close</Button>
        </Modal.Footer>
      </Modal>

      </div>
    </div>
  )
}
