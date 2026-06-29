import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Button, Spinner } from 'react-bootstrap';
import Plot from 'react-plotly.js';
import axios from 'axios';
import { API_BASE_URL } from './config';

export default function AdvancedAnalytics({ dataset, user, onClose }) {
  const [chartData, setChartData] = useState(null);
  const [loadingChart, setLoadingChart] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!dataset) return;
    
    const fetchData = async () => {
      setLoadingChart(true);
      setError('');
      try {
        // 1. Fetch schema to get a default X column
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

        // 2. Fetch chart data for default X column, using count aggregation
        const chartRes = await axios.post(`${API_BASE_URL}/api/datasets/${dataset.id}/chart`, {
          chart_type: 'bar',
          x_col: defaultXCol,
          y_col: '', // Auto Count
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

  const getPlotData = (type) => {
    if (!chartData) return [];
    
    const trace = {
      x: chartData.x,
      y: chartData.y,
      type: type === 'line' ? 'scatter' : 'bar',
      marker: { color: type === 'bar' ? '#5A4FD6' : undefined }
    };
    
    if (type === 'line') {
      trace.mode = 'lines+markers';
      trace.line = { color: '#7ED7F7', width: 3 };
    }
    
    return [trace];
  };

  const commonLayout = {
    paper_bgcolor: 'rgba(0,0,0,0)', 
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: {color: '#cbd5e1'},
    xaxis: {gridcolor: 'rgba(255,255,255,0.1)'},
    yaxis: {gridcolor: 'rgba(255,255,255,0.1)'},
    margin: { b: 80, t: 40, l: 60, r: 20 },
    hovermode: 'closest',
    autosize: true
  };

  if (!dataset) return null;

  return (
    <div className="mt-5 border-top border-secondary pt-5">
      <Row className="mb-4">
        <Col className="d-flex justify-content-between align-items-center">
          <div>
            <h3 className="fw-bold m-0">Quick Analysis: <span className="text-primary">{dataset.dataset_name}</span></h3>
            {chartData && <p className="text-muted mt-2 mb-0">Showing Record Count grouped by {chartData.xCol}</p>}
          </div>
          <Button variant="outline-secondary" size="sm" onClick={onClose}>Close Analysis</Button>
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
          <Col md={6}>
            <Card className="glass-card h-100">
              <Card.Body>
                <h5 className="text-white mb-3 text-center">Bar Graph</h5>
                <Plot
                  data={getPlotData('bar')}
                  layout={commonLayout}
                  useResizeHandler={true}
                  style={{ width: "100%", minHeight: "400px" }}
                  config={{ displayModeBar: true, displaylogo: false, responsive: true, modeBarButtonsToRemove: ['zoom2d', 'pan2d', 'select2d', 'lasso2d', 'resetScale2d'] }}
                />
              </Card.Body>
            </Card>
          </Col>
          <Col md={6}>
            <Card className="glass-card h-100">
              <Card.Body>
                <h5 className="text-white mb-3 text-center">Line Graph</h5>
                <Plot
                  data={getPlotData('line')}
                  layout={commonLayout}
                  useResizeHandler={true}
                  style={{ width: "100%", minHeight: "400px" }}
                  config={{ displayModeBar: true, displaylogo: false, responsive: true, modeBarButtonsToRemove: ['zoom2d', 'pan2d', 'select2d', 'lasso2d', 'resetScale2d'] }}
                />
              </Card.Body>
            </Card>
          </Col>
        </Row>
      ) : null}
    </div>
  );
}
