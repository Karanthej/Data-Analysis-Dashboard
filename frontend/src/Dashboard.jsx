import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Row, Col, Card, Button, Form, Table, Badge, Dropdown, Spinner } from 'react-bootstrap';
import Plot from 'react-plotly.js';
import axios from 'axios';
import { API_BASE_URL } from './config';
import AppNavbar from './components/AppNavbar';
import DatasetPreviewModal from './components/DatasetPreviewModal';
import BIIntegrationModal from './components/BIIntegrationModal';

export default function Dashboard({ user, setUser }) {
  const navigate = useNavigate();
  
  const [datasets, setDatasets] = useState([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  
  // Modals state
  const [previewModal, setPreviewModal] = useState({ show: false, dataset: null });
  const [biModal, setBiModal] = useState({ show: false, dataset: null });
  
  // Analyze state
  const [analyzingDataset, setAnalyzingDataset] = useState(null);
  const [insights, setInsights] = useState(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  
  const [error, setError] = useState('');

  // 1. Fetch datasets
  const fetchDatasets = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/datasets`, {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      setDatasets(res.data);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch datasets');
    }
  };

  useEffect(() => {
    fetchDatasets();
  }, [user.token]);

  // Handle Upload
  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('dataset_name', file.name);

    setUploading(true);
    setError('');
    try {
      await axios.post(`${API_BASE_URL}/api/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${user.token}`
        }
      });
      fetchDatasets();
    } catch (err) {
      setError(err.response?.data?.message || 'Error uploading dataset');
    }
    setUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Actions
  const handleRename = async (id, currentName) => {
    const newName = prompt("Enter new dataset name:", currentName);
    if (newName && newName !== currentName) {
      try {
        await axios.put(`${API_BASE_URL}/api/datasets/${id}`, { dataset_name: newName }, {
          headers: { Authorization: `Bearer ${user.token}` }
        });
        fetchDatasets();
      } catch (err) {
        alert(err.response?.data?.message || 'Failed to rename dataset');
      }
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this dataset?")) {
      try {
        await axios.delete(`${API_BASE_URL}/api/datasets/${id}`, {
          headers: { Authorization: `Bearer ${user.token}` }
        });
        if (analyzingDataset?.id === id) setAnalyzingDataset(null);
        fetchDatasets();
      } catch (err) {
        alert(err.response?.data?.message || 'Failed to delete dataset');
      }
    }
  };

  const handleDownload = (id) => {
    window.open(`${API_BASE_URL}/api/datasets/${id}/download?token=${user.token}`, '_blank');
    // Note: Since download needs auth, using query param or handling via blob is needed.
    // For simplicity in UI, we trigger an axios fetch and download the blob.
    axios.get(`${API_BASE_URL}/api/datasets/${id}/download`, {
      headers: { Authorization: `Bearer ${user.token}` },
      responseType: 'blob',
    }).then((response) => {
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      // try to extract filename from content-disposition header if needed
      link.setAttribute('download', `dataset_${id}`); 
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }).catch(err => alert("Failed to download"));
  };

  const handleAnalyze = async (dataset) => {
    setAnalyzingDataset(dataset);
    setLoadingInsights(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/insights/${dataset.id}`, {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      setInsights(res.data);
    } catch (err) {
      alert('Failed to analyze dataset');
      setInsights(null);
    }
    setLoadingInsights(false);
  };

  const formatValue = (val) => {
    if (typeof val === 'number') {
      if (val % 1 !== 0) return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return val.toLocaleString();
    }
    return val;
  };
  
  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div style={{ position: 'relative', minHeight: '100vh', overflowX: 'hidden' }}>
      <div style={{ position: 'relative', zIndex: 1 }}>
        <AppNavbar user={user} setUser={setUser}>
          <div className="d-flex align-items-center">
            <input 
              type="file" 
              accept=".csv, .xlsx, .xls" 
              style={{ display: 'none' }} 
              ref={fileInputRef} 
              onChange={handleUpload} 
            />
            <Button 
              variant="primary" 
              size="sm" 
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="fw-bold px-4"
            >
              {uploading ? 'Uploading...' : 'Upload Dataset'}
            </Button>
          </div>
        </AppNavbar>

        <Container fluid className="mt-5 px-4">
          <Row className="mb-4">
            <Col>
              <h2 style={{ fontSize: '2.5rem', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 0 }}>
                My <span className="text-gradient">Datasets</span>
              </h2>
              <p style={{ color: 'var(--text-secondary)' }}>Manage and analyze your isolated data environment.</p>
            </Col>
          </Row>

          {error && <div className="alert alert-danger">{error}</div>}

          <Row className="mb-5">
            <Col>
              <Card className="glass-card">
                <Card.Body className="p-0">
                  <Table variant="dark" hover className="mb-0 align-middle">
                    <thead style={{ borderBottom: '2px solid var(--border-color)' }}>
                      <tr>
                        <th className="py-3 px-4">Dataset Name</th>
                        <th className="py-3">Type</th>
                        <th className="py-3">Rows</th>
                        <th className="py-3">Columns</th>
                        <th className="py-3">Size</th>
                        <th className="py-3">Upload Date</th>
                        <th className="py-3">Status</th>
                        <th className="py-3 text-end px-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {datasets.length === 0 ? (
                        <tr>
                          <td colSpan="8" className="text-center py-5 text-muted">
                            No datasets uploaded yet. Click "Upload Dataset" to begin.
                          </td>
                        </tr>
                      ) : (
                        datasets.map(d => (
                          <tr key={d.id}>
                            <td className="px-4 fw-bold">{d.dataset_name}</td>
                            <td><Badge bg="secondary" className="text-uppercase">{d.file_name.split('.').pop()}</Badge></td>
                            <td>{d.rows ? d.rows.toLocaleString() : '-'}</td>
                            <td>{d.columns ? d.columns.toLocaleString() : '-'}</td>
                            <td>{formatBytes(d.file_size)}</td>
                            <td>{d.upload_date} <small className="text-muted">{d.upload_time}</small></td>
                            <td><Badge bg="success">{d.status}</Badge></td>
                            <td className="text-end px-4">
                              <Dropdown align="end">
                                <Dropdown.Toggle variant="outline-light" size="sm">
                                  Actions
                                </Dropdown.Toggle>
                                <Dropdown.Menu variant="dark">
                                  <Dropdown.Item onClick={() => setPreviewModal({ show: true, dataset: d })}>View (Preview)</Dropdown.Item>
                                  <Dropdown.Item onClick={() => handleAnalyze(d)}>Analyze</Dropdown.Item>
                                  <Dropdown.Item onClick={() => setBiModal({ show: true, dataset: d })}>Visualize (BI)</Dropdown.Item>
                                  <Dropdown.Divider />
                                  <Dropdown.Item onClick={() => handleDownload(d.id)}>Download</Dropdown.Item>
                                  <Dropdown.Item onClick={() => handleRename(d.id, d.dataset_name)}>Rename</Dropdown.Item>
                                  <Dropdown.Item className="text-danger" onClick={() => handleDelete(d.id)}>Delete</Dropdown.Item>
                                </Dropdown.Menu>
                              </Dropdown>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </Table>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {/* Analysis Section */}
          {analyzingDataset && (
            <div className="mt-5 border-top border-secondary pt-5">
              <Row className="mb-4">
                <Col className="d-flex justify-content-between align-items-center">
                  <h3 className="fw-bold m-0">Analysis: <span className="text-primary">{analyzingDataset.dataset_name}</span></h3>
                  <Button variant="outline-secondary" size="sm" onClick={() => setAnalyzingDataset(null)}>Close Analysis</Button>
                </Col>
              </Row>

              {loadingInsights ? (
                <div className="text-center py-5"><Spinner animation="border" variant="primary" /></div>
              ) : insights ? (
                <>
                  <Row className="mb-4 justify-content-center">
                    {insights.kpis.map((kpi, idx) => (
                      <Col md="auto" key={idx} style={{ flex: '1 1 0', minWidth: '200px' }} className="mb-3">
                        <Card className="text-center glass-card h-100">
                          <Card.Body className="d-flex flex-column justify-content-center">
                            <Card.Title className="text-muted" style={{fontSize: '0.9rem'}}>{kpi.title}</Card.Title>
                            <h4 className="mt-2 text-truncate" title={kpi.value}>{formatValue(kpi.value)}</h4>
                          </Card.Body>
                        </Card>
                      </Col>
                    ))}
                  </Row>
                  
                  <Row>
                    <Col md={6} className="mb-4">
                      {insights.bar_chart ? (
                        <Card className="glass-card h-100">
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
                                  width: 500, height: 350, 
                                  paper_bgcolor: 'rgba(0,0,0,0)', 
                                  plot_bgcolor: 'rgba(0,0,0,0)',
                                  font: {color: '#cbd5e1'},
                                  xaxis: {gridcolor: 'rgba(255,255,255,0.1)', title: insights.bar_chart.cat_col, tickangle: -45},
                                  yaxis: {gridcolor: 'rgba(255,255,255,0.1)', title: insights.bar_chart.num_col},
                                  margin: { b: 80, t: 20 }
                                }}
                                config={{displayModeBar: false}}
                              />
                            </div>
                          </Card.Body>
                        </Card>
                      ) : (
                        <Card className="glass-card h-100"><Card.Body>No bar chart insight generated.</Card.Body></Card>
                      )}
                    </Col>
                    
                    <Col md={6} className="mb-4">
                      {insights.line_chart ? (
                        <Card className="glass-card h-100">
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
                                  width: 500, height: 350, 
                                  paper_bgcolor: 'rgba(0,0,0,0)', 
                                  plot_bgcolor: 'rgba(0,0,0,0)',
                                  font: {color: '#cbd5e1'},
                                  xaxis: {gridcolor: 'rgba(255,255,255,0.1)', title: insights.line_chart.cat_col, tickangle: -45},
                                  yaxis: {gridcolor: 'rgba(255,255,255,0.1)', title: insights.line_chart.num_col},
                                  margin: { b: 80, t: 20 }
                                }}
                                config={{displayModeBar: false}}
                              />
                            </div>
                          </Card.Body>
                        </Card>
                      ) : (
                        <Card className="glass-card h-100"><Card.Body>No line chart insight generated.</Card.Body></Card>
                      )}
                    </Col>
                  </Row>
                </>
              ) : null}
            </div>
          )}

        </Container>
      </div>

      <DatasetPreviewModal 
        show={previewModal.show} 
        onHide={() => setPreviewModal({ show: false, dataset: null })} 
        dataset={previewModal.dataset}
        user={user}
      />

      <BIIntegrationModal 
        show={biModal.show} 
        onHide={() => setBiModal({ show: false, dataset: null })} 
        dataset={biModal.dataset}
        user={user}
      />
    </div>
  );
}
