import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Spinner, Button } from 'react-bootstrap';
import Plot from 'react-plotly.js';
import axios from 'axios';
import { API_BASE_URL } from '../config';

export default function InlineBIVisualization({ dataset, user, onClose }) {
  const [chartData, setChartData] = useState(null);
  const [loadingChart, setLoadingChart] = useState(true);
  const [error, setError] = useState('');
  
  // 'bar' or 'funnel' or null
  const [expandedCard, setExpandedCard] = useState(null);

  useEffect(() => {
    if (!dataset) return;
    
    const fetchData = async () => {
      setLoadingChart(true);
      setError('');
      try {
        const schemaRes = await axios.get(`${API_BASE_URL}/api/datasets/${dataset.id}/preview`, {
          headers: { Authorization: `Bearer ${user.token}` }
        });
        const columns = schemaRes.data.columns || [];
        if (columns.length === 0) {
          setError('Dataset has no columns to chart.');
          setLoadingChart(false);
          return;
        }
        
        const defaultXCol = columns[0];

        const chartRes = await axios.post(`${API_BASE_URL}/api/datasets/${dataset.id}/chart`, {
          chart_type: 'bar',
          x_col: defaultXCol,
          y_col: '', 
          group_col: '',
          agg_func: 'count',
          filters: []
        }, {
          headers: { Authorization: `Bearer ${user.token}` }
        });
        
        setChartData({
          x: chartRes.data.data.x,
          y: chartRes.data.data.y,
          xCol: defaultXCol
        });
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to generate charts');
      }
      setLoadingChart(false);
    };
    
    fetchData();
  }, [dataset, user.token]);

  const getPlotlyBarData = () => {
    if (!chartData) return [];
    return [{
      x: chartData.x,
      y: chartData.y,
      type: 'bar',
      marker: { color: '#06B6D4' }
    }];
  };

  const getPlotlyFunnelData = () => {
    if (!chartData) return [];
    
    // Sort descending for a funnel shape
    let combined = chartData.x.map((cat, i) => ({ label: String(cat), value: chartData.y[i] }));
    combined.sort((a, b) => b.value - a.value);
    
    return [{
      type: 'funnel',
      y: combined.map(item => item.label),
      x: combined.map(item => item.value),
      textinfo: "value+percent initial",
      marker: {
        color: ['#06B6D4', '#22D3EE', '#38BDF8', '#67E8F9', '#7ED7F7']
      }
    }];
  };

  const baseLayout = {
    paper_bgcolor: 'rgba(0,0,0,0)', 
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: {color: '#cbd5e1'},
    margin: { b: 40, t: 40, l: 40, r: 20 },
    hovermode: 'closest',
    autosize: true
  };
  
  const barLayout = {
    ...baseLayout,
    xaxis: {gridcolor: 'rgba(255,255,255,0.1)'},
    yaxis: {gridcolor: 'rgba(255,255,255,0.1)'},
  };
  
  const funnelLayout = {
    ...baseLayout,
    margin: { b: 40, t: 40, l: 120, r: 20 },
  };

  if (!dataset) return null;

  const handleCardClick = (cardName) => {
    if (expandedCard === cardName) {
      setExpandedCard(null);
    } else {
      setExpandedCard(cardName);
    }
  };

  const getCardStyle = (cardName) => {
    const isExpanded = expandedCard === cardName;
    return {
      position: isExpanded ? 'fixed' : 'relative',
      top: isExpanded ? '5%' : 'auto',
      left: isExpanded ? '5%' : 'auto',
      width: isExpanded ? '90vw' : '100%',
      height: isExpanded ? '90vh' : '100%',
      zIndex: isExpanded ? 1050 : 1,
      transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
      cursor: isExpanded ? 'default' : 'pointer'
    };
  };

  return (
    <div className="mt-5 border-top border-secondary pt-5" id="bi-section">
      {/* Backdrop for expanded mode */}
      {expandedCard && (
        <div 
          onClick={() => setExpandedCard(null)}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 1040,
            cursor: 'pointer'
          }}
        />
      )}

      <Row className="mb-4">
        <Col className="d-flex justify-content-between align-items-center">
          <div>
            <h3 className="fw-bold m-0">BI Visualization: <span className="text-primary">{dataset.dataset_name}</span></h3>
            <p className="text-muted mt-2 mb-0">Powered by Plotly (Click a chart to expand)</p>
          </div>
          <Button variant="outline-secondary" size="sm" onClick={onClose}>Close Visualization</Button>
        </Col>
      </Row>

      {error && <div className="alert alert-danger">{error}</div>}

      {loadingChart ? (
        <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '300px' }}>
          <Spinner animation="border" variant="primary" />
          <span className="ms-3 text-muted">Analyzing dataset...</span>
        </div>
      ) : chartData ? (
        <Row>
          {/* Plotly Bar Card */}
          <Col md={6}>
            <div style={expandedCard === 'bar' ? { width: '100%', height: '400px' } : {}}>
              <Card 
                className="glass-card" 
                style={getCardStyle('bar')}
                onClick={(e) => { if(expandedCard !== 'bar') handleCardClick('bar'); }}
              >
                <Card.Body className="d-flex flex-column h-100">
                  <div className="d-flex justify-content-between align-items-center mb-4">
                    <div className="d-flex align-items-center">
                      <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '15px' }}>
                        <span style={{ color: '#000000', fontWeight: 'bold', fontSize: '1.2rem' }}>P</span>
                      </div>
                      <h4 className="mb-0 text-white">Bar Chart</h4>
                    </div>
                    {expandedCard === 'bar' && (
                      <Button variant="outline-light" size="sm" onClick={() => handleCardClick('bar')}>Close Expand</Button>
                    )}
                  </div>
                  
                  <div className="flex-grow-1" style={{ minHeight: expandedCard === 'bar' ? '70vh' : '300px' }}>
                    <Plot
                      data={getPlotlyBarData()}
                      layout={barLayout}
                      useResizeHandler={true}
                      style={{ width: "100%", height: "100%" }}
                      config={{ displayModeBar: true, displaylogo: false, responsive: true }}
                    />
                  </div>
                </Card.Body>
              </Card>
            </div>
          </Col>

          {/* Plotly Funnel Card */}
          <Col md={6}>
            <div style={expandedCard === 'funnel' ? { width: '100%', height: '400px' } : {}}>
              <Card 
                className="glass-card" 
                style={getCardStyle('funnel')}
                onClick={(e) => { if(expandedCard !== 'funnel') handleCardClick('funnel'); }}
              >
                <Card.Body className="d-flex flex-column h-100">
                  <div className="d-flex justify-content-between align-items-center mb-4">
                    <div className="d-flex align-items-center">
                      <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#D98AF7', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '15px' }}>
                        <span style={{ color: '#ffffff', fontWeight: 'bold', fontSize: '1.2rem' }}>F</span>
                      </div>
                      <h4 className="mb-0 text-white">Funnel Graph</h4>
                    </div>
                    {expandedCard === 'funnel' && (
                      <Button variant="outline-light" size="sm" onClick={() => handleCardClick('funnel')}>Close Expand</Button>
                    )}
                  </div>
                  
                  <div className="flex-grow-1" style={{ minHeight: expandedCard === 'funnel' ? '70vh' : '300px' }}>
                    <Plot
                      data={getPlotlyFunnelData()}
                      layout={funnelLayout}
                      useResizeHandler={true}
                      style={{ width: "100%", height: "100%" }}
                      config={{ displayModeBar: true, displaylogo: false, responsive: true }}
                    />
                  </div>
                </Card.Body>
              </Card>
            </div>
          </Col>
        </Row>
      ) : null}
    </div>
  );
}
