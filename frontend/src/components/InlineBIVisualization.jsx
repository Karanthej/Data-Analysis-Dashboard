import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Spinner, Button } from 'react-bootstrap';
import axios from 'axios';
import { API_BASE_URL } from '../config';

export default function InlineBIVisualization({ dataset, user, onClose }) {
  const [loadingTableau, setLoadingTableau] = useState(true);
  const [loadingPowerBI, setLoadingPowerBI] = useState(true);
  
  const [tableauUrl, setTableauUrl] = useState('');
  const [powerBIUrl, setPowerBIUrl] = useState('');
  
  const [tableauMessage, setTableauMessage] = useState('');
  const [powerBIMessage, setPowerBIMessage] = useState('');

  useEffect(() => {
    if (!dataset) return;

    const fetchEmbeds = async () => {
      // Fetch Tableau embed
      setLoadingTableau(true);
      try {
        const res = await axios.get(`${API_BASE_URL}/api/datasets/${dataset.id}/embed/tableau`, {
          headers: { Authorization: `Bearer ${user.token}` }
        });
        setTableauUrl(res.data.embed_url);
        setTableauMessage(res.data.message);
      } catch (err) {
        setTableauMessage('Failed to connect to Tableau');
      }
      setLoadingTableau(false);

      // Fetch Power BI embed
      setLoadingPowerBI(true);
      try {
        const res = await axios.get(`${API_BASE_URL}/api/datasets/${dataset.id}/embed/powerbi`, {
          headers: { Authorization: `Bearer ${user.token}` }
        });
        setPowerBIUrl(res.data.embed_url);
        setPowerBIMessage(res.data.message);
      } catch (err) {
        setPowerBIMessage('Failed to connect to Power BI');
      }
      setLoadingPowerBI(false);
    };

    fetchEmbeds();
  }, [dataset, user.token]);

  if (!dataset) return null;

  return (
    <div className="mt-5 border-top border-secondary pt-5" id="bi-section">
      <Row className="mb-4">
        <Col className="d-flex justify-content-between align-items-center">
          <div>
            <h3 className="fw-bold m-0">BI Visualization: <span className="text-primary">{dataset.dataset_name}</span></h3>
            <p className="text-muted mt-2 mb-0">Embedded dashboards for Tableau and Power BI</p>
          </div>
          <Button variant="outline-secondary" size="sm" onClick={onClose}>Close Visualization</Button>
        </Col>
      </Row>

      <Row>
        <Col md={6}>
          <Card className="glass-card h-100">
            <Card.Body className="d-flex flex-column">
              <div className="d-flex align-items-center mb-4">
                <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#e9ecef', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '15px' }}>
                  <span style={{ color: '#e97b32', fontWeight: 'bold', fontSize: '1.2rem' }}>T</span>
                </div>
                <h4 className="mb-0 text-white">Tableau Dashboard</h4>
              </div>
              
              <div className="flex-grow-1 d-flex flex-column align-items-center justify-content-center" style={{ minHeight: '400px', backgroundColor: 'rgba(0,0,0,0.2)', border: '1px dashed #475569', borderRadius: '8px' }}>
                {loadingTableau ? (
                  <Spinner animation="border" variant="primary" />
                ) : tableauUrl ? (
                  <div className="text-center">
                    <div className="text-primary mb-3">Live Connection Established</div>
                    <span className="text-muted small d-block mb-3 px-4">{tableauMessage}</span>
                    <span className="badge bg-dark border border-secondary text-info p-2">{tableauUrl}</span>
                  </div>
                ) : (
                  <div className="text-danger">{tableauMessage}</div>
                )}
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col md={6}>
          <Card className="glass-card h-100">
            <Card.Body className="d-flex flex-column">
              <div className="d-flex align-items-center mb-4">
                <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#e9ecef', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '15px' }}>
                  <span style={{ color: '#f2c811', fontWeight: 'bold', fontSize: '1.2rem' }}>P</span>
                </div>
                <h4 className="mb-0 text-white">Power BI Report</h4>
              </div>
              
              <div className="flex-grow-1 d-flex flex-column align-items-center justify-content-center" style={{ minHeight: '400px', backgroundColor: 'rgba(0,0,0,0.2)', border: '1px dashed #475569', borderRadius: '8px' }}>
                {loadingPowerBI ? (
                  <Spinner animation="border" variant="warning" />
                ) : powerBIUrl ? (
                  <div className="text-center">
                    <div className="text-warning mb-3">Live Connection Established</div>
                    <span className="text-muted small d-block mb-3 px-4">{powerBIMessage}</span>
                    <span className="badge bg-dark border border-secondary text-info p-2">{powerBIUrl}</span>
                  </div>
                ) : (
                  <div className="text-danger">{powerBIMessage}</div>
                )}
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
