import React, { useState } from 'react';
import { Modal, Button, Tabs, Tab, Card, Spinner } from 'react-bootstrap';
import axios from 'axios';
import { API_BASE_URL } from '../config';

export default function BIIntegrationModal({ show, onHide, dataset, user }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [embedUrl, setEmbedUrl] = useState('');
  const [activeTab, setActiveTab] = useState('tableau');

  const handleAction = async (provider, actionType) => {
    setLoading(true);
    setMessage('');
    setEmbedUrl('');
    
    try {
      if (actionType === 'export') {
        const res = await axios.post(`${API_BASE_URL}/api/datasets/${dataset.id}/export/${provider}`, {}, {
          headers: { Authorization: `Bearer ${user.token}` }
        });
        setMessage(res.data.message);
      } else if (actionType === 'embed') {
        const res = await axios.get(`${API_BASE_URL}/api/datasets/${dataset.id}/embed/${provider}`, {
          headers: { Authorization: `Bearer ${user.token}` }
        });
        setEmbedUrl(res.data.embed_url);
        setMessage(res.data.message);
      }
    } catch (err) {
      setMessage(err.response?.data?.message || `Failed to connect to ${provider}`);
    }
    setLoading(false);
  };

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton className="bg-dark text-white border-bottom-0">
        <Modal.Title className="fw-bold">BI Integration: {dataset?.dataset_name}</Modal.Title>
      </Modal.Header>
      <Modal.Body className="bg-dark text-white p-4 pt-0">
        <Tabs 
          activeKey={activeTab}
          onSelect={(k) => { setActiveTab(k); setMessage(''); setEmbedUrl(''); }}
          className="mb-4"
          variant="pills"
        >
          <Tab eventKey="tableau" title="Tableau">
            <Card className="glass-card mt-3">
              <Card.Body>
                <div className="d-flex align-items-center mb-4">
                  <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#e9ecef', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '15px' }}>
                    <span style={{ color: '#e97b32', fontWeight: 'bold', fontSize: '1.2rem' }}>T</span>
                  </div>
                  <h4 className="mb-0">Tableau Integration</h4>
                </div>
                
                <p className="text-muted mb-4">Connect your dataset to Tableau for advanced visualizations, story building, and interactive dashboards.</p>
                
                <div className="d-flex gap-3 flex-wrap">
                  <Button variant="outline-primary" onClick={() => handleAction('tableau', 'export')} disabled={loading}>
                    Export & Generate Extract
                  </Button>
                  <Button variant="primary" onClick={() => handleAction('tableau', 'embed')} disabled={loading}>
                    Embed Dashboard
                  </Button>
                </div>
              </Card.Body>
            </Card>
          </Tab>
          
          <Tab eventKey="powerbi" title="Power BI">
            <Card className="glass-card mt-3">
              <Card.Body>
                <div className="d-flex align-items-center mb-4">
                  <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#e9ecef', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '15px' }}>
                    <span style={{ color: '#f2c811', fontWeight: 'bold', fontSize: '1.2rem' }}>P</span>
                  </div>
                  <h4 className="mb-0">Power BI Integration</h4>
                </div>
                
                <p className="text-muted mb-4">Publish your datasets directly to Power BI Workspaces or embed interactive reports into this portal.</p>
                
                <div className="d-flex gap-3 flex-wrap">
                  <Button variant="outline-warning" onClick={() => handleAction('powerbi', 'export')} disabled={loading} style={{color: '#fff', borderColor: '#f2c811'}}>
                    Publish to Workspace
                  </Button>
                  <Button variant="warning" onClick={() => handleAction('powerbi', 'embed')} disabled={loading}>
                    Embed Report
                  </Button>
                </div>
              </Card.Body>
            </Card>
          </Tab>
        </Tabs>

        {loading && <div className="text-center my-4"><Spinner animation="border" variant="light" /></div>}
        
        {message && (
          <div className="alert alert-info mt-4 mb-0">
            {message}
          </div>
        )}
        
        {embedUrl && (
          <Card className="glass-card mt-4 border-primary">
            <Card.Body>
              <h5 className="text-primary mb-3">Embedded View Preview</h5>
              <div style={{ width: '100%', height: '300px', backgroundColor: '#1a1d24', border: '1px dashed #475569', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px' }}>
                <span className="text-muted">Iframe Placeholder: {embedUrl}</span>
              </div>
            </Card.Body>
          </Card>
        )}

      </Modal.Body>
      <Modal.Footer className="bg-dark border-top-0">
        <Button variant="outline-light" onClick={onHide}>Close</Button>
      </Modal.Footer>
    </Modal>
  );
}
