import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Container, Row, Col, Card, Form, Button, Spinner } from 'react-bootstrap';
import Plot from 'react-plotly.js';
import axios from 'axios';
import { API_BASE_URL } from './config';
import AppNavbar from './components/AppNavbar';

export default function AdvancedAnalytics({ user, setUser }) {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [columns, setColumns] = useState([]);
  const [loadingSchema, setLoadingSchema] = useState(true);
  
  // Controls
  const [chartType, setChartType] = useState('bar');
  const [xCol, setXCol] = useState('');
  const [yCol, setYCol] = useState('');
  const [groupCol, setGroupCol] = useState('');
  const [aggFunc, setAggFunc] = useState('sum');
  
  // Chart Data
  const [chartData, setChartData] = useState(null);
  const [loadingChart, setLoadingChart] = useState(false);
  const [error, setError] = useState('');

  const chartTypes = [
    'bar', 'line', 'pie', 'donut', 'histogram', 'scatter', 
    'heatmap', 'box', 'area', 'treemap', 'correlation'
  ];

  useEffect(() => {
    // Fetch schema using preview endpoint
    const fetchSchema = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/datasets/${id}/preview`, {
          headers: { Authorization: `Bearer ${user.token}` }
        });
        setColumns(res.data.columns || []);
        if (res.data.columns && res.data.columns.length > 0) {
          setXCol(res.data.columns[0]);
        }
      } catch (err) {
        setError('Failed to load dataset schema');
      }
      setLoadingSchema(false);
    };
    fetchSchema();
  }, [id, user.token]);

  const generateChart = async () => {
    if (!xCol && chartType !== 'correlation') {
      alert("Please select at least an X Column");
      return;
    }
    
    setLoadingChart(true);
    setError('');
    
    try {
      const res = await axios.post(`${API_BASE_URL}/api/datasets/${id}/chart`, {
        chart_type: chartType,
        x_col: xCol,
        y_col: yCol,
        group_col: groupCol,
        agg_func: aggFunc,
        filters: [] // MVP doesn't have complex filter builder yet, but supported
      }, {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      
      setChartData(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to generate chart');
      setChartData(null);
    }
    setLoadingChart(false);
  };

  // Helper to construct Plotly data object based on type
  const getPlotData = () => {
    if (!chartData) return [];
    
    if (chartType === 'correlation' || chartType === 'heatmap') {
      return [{
        x: chartData.x,
        y: chartData.y,
        z: chartData.z,
        type: 'heatmap',
        colorscale: 'Viridis'
      }];
    }
    
    if (chartType === 'pie' || chartType === 'donut') {
      return [{
        labels: chartData.labels,
        values: chartData.values,
        type: 'pie',
        hole: chartData.hole || 0,
        marker: { colors: ['#5A4FD6', '#7ED7F7', '#8B6EF8', '#14B8A6', '#F59E0B'] }
      }];
    }
    
    // Default 1D/2D
    const trace = {
      x: chartData.x,
      y: chartData.y,
      type: chartType === 'area' ? 'scatter' : chartType,
      marker: { color: '#5A4FD6' }
    };
    
    if (chartType === 'line' || chartType === 'area') {
      trace.type = 'scatter';
      trace.mode = 'lines+markers';
      trace.line = { color: '#7ED7F7', width: 3 };
      if (chartType === 'area') trace.fill = 'tozeroy';
    }
    
    return [trace];
  };

  return (
    <div style={{ position: 'relative', minHeight: '100vh', overflowX: 'hidden' }}>
      <div style={{ position: 'relative', zIndex: 1 }}>
        <AppNavbar user={user} setUser={setUser}>
          <Button variant="outline-light" size="sm" onClick={() => navigate('/')}>
            &larr; Back to Dashboard
          </Button>
        </AppNavbar>

        <Container fluid className="mt-4 px-4">
          <Row>
            <Col md={3}>
              <Card className="glass-card mb-4 h-100">
                <Card.Body>
                  <h4 className="text-white mb-4">Chart Controls</h4>
                  
                  {loadingSchema ? (
                    <Spinner animation="border" variant="light" />
                  ) : (
                    <Form>
                      <Form.Group className="mb-3">
                        <Form.Label className="text-muted small text-uppercase fw-bold">Chart Type</Form.Label>
                        <Form.Select 
                          value={chartType} 
                          onChange={(e) => setChartType(e.target.value)}
                          className="bg-dark text-white border-secondary"
                        >
                          {chartTypes.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                        </Form.Select>
                      </Form.Group>

                      {chartType !== 'correlation' && (
                        <>
                          <Form.Group className="mb-3">
                            <Form.Label className="text-muted small text-uppercase fw-bold">X Axis</Form.Label>
                            <Form.Select 
                              value={xCol} 
                              onChange={(e) => setXCol(e.target.value)}
                              className="bg-dark text-white border-secondary"
                            >
                              <option value="">-- Select Column --</option>
                              {columns.map(c => <option key={c} value={c}>{c}</option>)}
                            </Form.Select>
                          </Form.Group>

                          <Form.Group className="mb-3">
                            <Form.Label className="text-muted small text-uppercase fw-bold">Y Axis</Form.Label>
                            <Form.Select 
                              value={yCol} 
                              onChange={(e) => setYCol(e.target.value)}
                              className="bg-dark text-white border-secondary"
                            >
                              <option value="">-- Auto (Count) --</option>
                              {columns.map(c => <option key={c} value={c}>{c}</option>)}
                            </Form.Select>
                          </Form.Group>

                          <Form.Group className="mb-3">
                            <Form.Label className="text-muted small text-uppercase fw-bold">Aggregation</Form.Label>
                            <Form.Select 
                              value={aggFunc} 
                              onChange={(e) => setAggFunc(e.target.value)}
                              className="bg-dark text-white border-secondary"
                            >
                              <option value="sum">Sum</option>
                              <option value="mean">Average</option>
                              <option value="count">Count</option>
                              <option value="min">Minimum</option>
                              <option value="max">Maximum</option>
                            </Form.Select>
                          </Form.Group>

                          {chartType === 'heatmap' && (
                            <Form.Group className="mb-3">
                              <Form.Label className="text-muted small text-uppercase fw-bold">Group By (Z Axis)</Form.Label>
                              <Form.Select 
                                value={groupCol} 
                                onChange={(e) => setGroupCol(e.target.value)}
                                className="bg-dark text-white border-secondary"
                              >
                                <option value="">-- Select Column --</option>
                                {columns.map(c => <option key={c} value={c}>{c}</option>)}
                              </Form.Select>
                            </Form.Group>
                          )}
                        </>
                      )}

                      <Button 
                        variant="primary" 
                        className="w-100 mt-4 fw-bold" 
                        onClick={generateChart}
                        disabled={loadingChart}
                      >
                        {loadingChart ? 'Generating...' : 'Generate Chart'}
                      </Button>
                    </Form>
                  )}
                </Card.Body>
              </Card>
            </Col>
            
            <Col md={9}>
              <Card className="glass-card h-100">
                <Card.Body className="d-flex flex-column">
                  <h4 className="text-white mb-2">Interactive Canvas</h4>
                  <p className="text-muted small mb-4">
                    Plotly supports native exporting. Hover over the top right of the chart to access the modebar for Download (PNG), Zoom, Pan, and Box Select.
                  </p>
                  
                  {error && <div className="alert alert-danger">{error}</div>}
                  
                  <div className="flex-grow-1 d-flex align-items-center justify-content-center" style={{ minHeight: '600px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                    {loadingChart ? (
                      <Spinner animation="border" variant="primary" />
                    ) : chartData ? (
                      <Plot
                        data={getPlotData()}
                        layout={{ 
                          width: 800, height: 550, 
                          paper_bgcolor: 'rgba(0,0,0,0)', 
                          plot_bgcolor: 'rgba(0,0,0,0)',
                          font: {color: '#cbd5e1'},
                          xaxis: {gridcolor: 'rgba(255,255,255,0.1)'},
                          yaxis: {gridcolor: 'rgba(255,255,255,0.1)'},
                          margin: { b: 80, t: 20 },
                          hovermode: 'closest'
                        }}
                        config={{
                          displayModeBar: true,
                          displaylogo: false,
                          toImageButtonOptions: {
                            format: 'png', // png, svg, jpeg, webp
                            filename: 'custom_chart',
                            height: 600,
                            width: 800,
                            scale: 2
                          }
                        }}
                      />
                    ) : (
                      <div className="text-muted">Configure your chart controls and click Generate.</div>
                    )}
                  </div>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Container>
      </div>
    </div>
  );
}
