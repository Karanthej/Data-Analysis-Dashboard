import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Row, Col, Card, Button, Form, Table, Badge, Dropdown, InputGroup } from 'react-bootstrap';
import axios from 'axios';
import { API_BASE_URL } from './config';
import AppNavbar from './components/AppNavbar';
import DatasetPreviewModal from './components/DatasetPreviewModal';
import AdvancedAnalytics from './AdvancedAnalytics';
import InlineBIVisualization from './components/InlineBIVisualization';

export default function Dashboard({ user, setUser }) {
  const navigate = useNavigate();
  
  const [datasets, setDatasets] = useState([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  
  // Modals state
  const [previewModal, setPreviewModal] = useState({ show: false, dataset: null });
  
  const [error, setError] = useState('');

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [sortBy, setSortBy] = useState('latest');

  // Fetch datasets
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

  // Derived filtered & sorted datasets
  const filteredDatasets = useMemo(() => {
    let result = [...datasets];
    
    if (searchQuery) {
      result = result.filter(d => d.dataset_name.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    if (filterType) {
      result = result.filter(d => d.file_name.toLowerCase().endsWith(filterType.toLowerCase()));
    }
    if (filterStatus) {
      result = result.filter(d => d.status.toLowerCase() === filterStatus.toLowerCase());
    }
    
    result.sort((a, b) => {
      const dateA = new Date(`${a.upload_date}T${a.upload_time || '00:00:00'}`);
      const dateB = new Date(`${b.upload_date}T${b.upload_time || '00:00:00'}`);
      switch (sortBy) {
        case 'latest': return dateB - dateA;
        case 'oldest': return dateA - dateB;
        case 'name_asc': return a.dataset_name.localeCompare(b.dataset_name);
        case 'name_desc': return b.dataset_name.localeCompare(a.dataset_name);
        case 'size': return (b.file_size || 0) - (a.file_size || 0);
        default: return 0;
      }
    });
    
    return result;
  }, [datasets, searchQuery, filterType, filterStatus, sortBy]);

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
        fetchDatasets();
      } catch (err) {
        alert(err.response?.data?.message || 'Failed to delete dataset');
      }
    }
  };

  const handleDownload = (id) => {
    axios.get(`${API_BASE_URL}/api/datasets/${id}/download`, {
      headers: { Authorization: `Bearer ${user.token}` },
      responseType: 'blob',
    }).then((response) => {
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `dataset_${id}`); 
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }).catch(err => alert("Failed to download"));
  };

  const [analyzingDataset, setAnalyzingDataset] = useState(null);
  const [visualizingDataset, setVisualizingDataset] = useState(null);

  const handleAnalyze = (dataset) => {
    setAnalyzingDataset(dataset);
    setVisualizingDataset(null); // Close the other
    setTimeout(() => {
      document.getElementById('analytics-section')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleVisualize = (dataset) => {
    setVisualizingDataset(dataset);
    setAnalyzingDataset(null); // Close the other
    setTimeout(() => {
      document.getElementById('bi-section')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
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

          {/* Search and Filters Toolbar */}
          <Row className="mb-4">
            <Col md={12}>
              <Card className="glass-card" style={{ padding: '15px' }}>
                <div className="d-flex flex-wrap gap-3 align-items-center">
                  <div style={{ flex: '1 1 250px' }}>
                    <Form.Control 
                      type="text" 
                      placeholder="Search dataset name..." 
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      style={{ backgroundColor: 'rgba(15, 23, 42, 0.5)', color: 'white', border: '1px solid var(--border-color)' }}
                    />
                  </div>
                  <div>
                    <Form.Select 
                      value={filterType} 
                      onChange={e => setFilterType(e.target.value)}
                      style={{ backgroundColor: 'rgba(15, 23, 42, 0.5)', color: 'white', border: '1px solid var(--border-color)', minWidth: '150px' }}
                    >
                      <option value="">All Types</option>
                      <option value="csv">CSV</option>
                      <option value="xlsx">XLSX / XLS</option>
                    </Form.Select>
                  </div>
                  <div>
                    <Form.Select 
                      value={filterStatus} 
                      onChange={e => setFilterStatus(e.target.value)}
                      style={{ backgroundColor: 'rgba(15, 23, 42, 0.5)', color: 'white', border: '1px solid var(--border-color)', minWidth: '150px' }}
                    >
                      <option value="">All Statuses</option>
                      <option value="Uploaded">Uploaded</option>
                      <option value="Ready">Ready</option>
                      <option value="Processing">Processing</option>
                    </Form.Select>
                  </div>
                  <div className="d-flex align-items-center gap-2" style={{ marginLeft: 'auto' }}>
                    <span className="text-muted small fw-bold text-uppercase">Sort by:</span>
                    <Form.Select 
                      value={sortBy} 
                      onChange={e => setSortBy(e.target.value)}
                      style={{ backgroundColor: 'rgba(15, 23, 42, 0.5)', color: 'white', border: '1px solid var(--border-color)', minWidth: '160px' }}
                    >
                      <option value="latest">Latest Upload</option>
                      <option value="oldest">Oldest Upload</option>
                      <option value="name_asc">Name (A-Z)</option>
                      <option value="name_desc">Name (Z-A)</option>
                      <option value="size">Size</option>
                    </Form.Select>
                  </div>
                </div>
              </Card>
            </Col>
          </Row>

          <Row className="mb-5">
            <Col>
              <Card className="glass-card visible-overflow">
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
                      {filteredDatasets.length === 0 ? (
                        <tr>
                          <td colSpan="8" className="text-center py-5 text-muted">
                            {datasets.length === 0 ? 'No datasets uploaded yet. Click "Upload Dataset" to begin.' : 'No datasets match your filters.'}
                          </td>
                        </tr>
                      ) : (
                        filteredDatasets.map(d => (
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
                                  <Dropdown.Item onClick={() => handleVisualize(d)}>Visualize (BI)</Dropdown.Item>
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

          {analyzingDataset && (
            <div id="analytics-section">
              <AdvancedAnalytics 
                dataset={analyzingDataset} 
                user={user} 
                onClose={() => setAnalyzingDataset(null)} 
              />
            </div>
          )}

          {visualizingDataset && (
            <div id="bi-section">
              <InlineBIVisualization 
                dataset={visualizingDataset} 
                user={user} 
                onClose={() => setVisualizingDataset(null)} 
              />
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
    </div>
  );
}
