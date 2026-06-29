import React, { useState, useEffect } from 'react';
import { Modal, Button, Table, Spinner, Row, Col, Card } from 'react-bootstrap';
import axios from 'axios';
import { API_BASE_URL } from '../config';

export default function DatasetPreviewModal({ show, onHide, dataset, user }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (show && dataset) {
      fetchPreview();
    }
  }, [show, dataset]);

  const fetchPreview = async () => {
    setLoading(true);
    setError('');
    setData(null);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/datasets/${dataset.id}/preview`, {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load preview');
    }
    setLoading(false);
  };

  return (
    <Modal show={show} onHide={onHide} size="xl" centered>
      <Modal.Header closeButton className="bg-dark text-white border-bottom-0">
        <Modal.Title className="fw-bold">Dataset Preview: {dataset?.dataset_name}</Modal.Title>
      </Modal.Header>
      <Modal.Body className="bg-dark text-white p-4">
        {loading && <div className="text-center my-5"><Spinner animation="border" variant="primary" /></div>}
        {error && <div className="alert alert-danger">{error}</div>}
        
        {data && (
          <div>
            <Row className="mb-4 g-3">
              <Col md={3}>
                <Card className="glass-card text-center h-100">
                  <Card.Body>
                    <div className="text-muted small text-uppercase">Total Rows</div>
                    <h3 className="text-primary mt-2">{data.rows_count.toLocaleString()}</h3>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={3}>
                <Card className="glass-card text-center h-100">
                  <Card.Body>
                    <div className="text-muted small text-uppercase">Total Columns</div>
                    <h3 className="text-primary mt-2">{data.cols_count.toLocaleString()}</h3>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={3}>
                <Card className="glass-card text-center h-100">
                  <Card.Body>
                    <div className="text-muted small text-uppercase">Missing Values</div>
                    <h3 className="text-warning mt-2">{data.missing_values_total.toLocaleString()}</h3>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={3}>
                <Card className="glass-card text-center h-100">
                  <Card.Body>
                    <div className="text-muted small text-uppercase">Duplicate Rows</div>
                    <h3 className="text-danger mt-2">{data.duplicates.toLocaleString()}</h3>
                  </Card.Body>
                </Card>
              </Col>
            </Row>

            <h5 className="mb-3 text-white">Data Dictionary & Null Stats</h5>
            <div className="table-responsive mb-4">
              <Table variant="dark" striped bordered hover size="sm">
                <thead>
                  <tr>
                    <th>Column Name</th>
                    <th>Data Type</th>
                    <th>Null Count</th>
                  </tr>
                </thead>
                <tbody>
                  {data.columns.map(col => (
                    <tr key={col}>
                      <td>{col}</td>
                      <td><code>{data.data_types[col]}</code></td>
                      <td>{data.null_stats[col]}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>

            <h5 className="mb-3 text-white">First 20 Rows</h5>
            <div className="table-responsive" style={{ maxHeight: '400px' }}>
              <Table variant="dark" striped bordered hover size="sm">
                <thead style={{ position: 'sticky', top: 0, background: '#212529', zIndex: 1 }}>
                  <tr>
                    {data.columns.map(col => <th key={col}>{col}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {data.head.map((row, idx) => (
                    <tr key={idx}>
                      {data.columns.map(col => (
                        <td key={col}>{String(row[col])}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </div>
        )}
      </Modal.Body>
      <Modal.Footer className="bg-dark border-top-0">
        <Button variant="outline-light" onClick={onHide}>Close Preview</Button>
      </Modal.Footer>
    </Modal>
  );
}
