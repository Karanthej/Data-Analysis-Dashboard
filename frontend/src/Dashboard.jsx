import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Container, Row, Col, Card, Navbar, Nav, Button, Form } from 'react-bootstrap'
import Plot from 'react-plotly.js'
import axios from 'axios'
import { API_BASE_URL } from './config'

export default function Dashboard({ user, setUser }) {
  const navigate = useNavigate()
  
  const [datasets, setDatasets] = useState([])
  const [selectedDatasetId, setSelectedDatasetId] = useState(null)
  
  const [insights, setInsights] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  const [availableFilters, setAvailableFilters] = useState([])
  const [selectedFilters, setSelectedFilters] = useState({})

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
        setError('Failed to fetch datasets.')
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

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('role')
    setUser(null)
    navigate('/login')
  }

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
            
            <Form.Select 
              value={selectedDatasetId || ''} 
              onChange={(e) => setSelectedDatasetId(e.target.value)}
              className="w-auto me-4"
              style={{ backgroundColor: 'rgba(15, 23, 42, 0.5)', color: 'white', border: '1px solid var(--border-color)' }}
            >
              {datasets.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </Form.Select>
            
            <Navbar.Text className="me-3">
              Signed in as: <span className="fw-bold text-info">{user.username}</span> <span className="text-muted">({user.role})</span>
            </Navbar.Text>
            <Button variant="outline-primary" size="sm" onClick={handleLogout}>Logout</Button>
          </Container>
        </Navbar>

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
                      {user.permissions?.includes('can_assess_risk') && <Button variant="outline-warning" size="sm" onClick={() => alert('Assessing risk...')}>Assess risk: Spot weak areas</Button>}
                      {user.permissions?.includes('can_test_controls') && <Button variant="outline-warning" size="sm" onClick={() => alert('Testing controls...')}>Test controls: Verify rules work</Button>}
                      {user.permissions?.includes('can_gather_evidence') && <Button variant="outline-warning" size="sm" onClick={() => alert('Gathering evidence...')}>Gather evidence: Check bank balances</Button>}
                      {user.permissions?.includes('can_verify_accuracy') && <Button variant="outline-warning" size="sm" onClick={() => alert('Verifying accuracy...')}>Verify accuracy: Recalculate financial data</Button>}
                      {user.permissions?.includes('can_ensure_compliance') && <Button variant="outline-warning" size="sm" onClick={() => alert('Ensuring compliance...')}>Ensure compliance: Follow current laws</Button>}
                      {user.permissions?.includes('can_issue_opinion') && <Button variant="outline-warning" size="sm" onClick={() => alert('Issuing opinion...')}>Issue opinion: Certify data fairness</Button>}
                      {user.permissions?.includes('can_report_findings') && <Button variant="outline-warning" size="sm" onClick={() => alert('Reporting findings...')}>Report findings: Inform company management</Button>}
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
                                colorscale: 'Tealgrn'
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
                              marker: {color: '#14b8a6'},
                              line: {color: '#10b981', width: 3}
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
      </div>
    </div>
  )
}
