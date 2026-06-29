import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Spinner, Button } from 'react-bootstrap';
import Plot from 'react-plotly.js';
import ReactECharts from 'echarts-for-react';
import axios from 'axios';
import { API_BASE_URL } from '../config';

export default function InlineBIVisualization({ dataset, user, onClose }) {
  const [chartData, setChartData] = useState(null);
  const [loadingChart, setLoadingChart] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!dataset) return;
    
    const fetchData = async () => {
      setLoadingChart(true);
      setError('');
      try {
        // Fetch schema to get a default X column
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

        // Fetch chart data for default X column, using count aggregation
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

  // ECharts Option
  const getEChartsOption = () => {
    if (!chartData) return {};
    return {
      backgroundColor: 'transparent',
      textStyle: { color: '#cbd5e1' },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: chartData.x,
        axisLine: { lineStyle: { color: '#475569' } },
        splitLine: { show: false }
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } }
      },
      series: [
        {
          name: 'Count',
          type: 'bar',
          data: chartData.y,
          itemStyle: {
            color: '#06B6D4',
            borderRadius: [4, 4, 0, 0]
          }
        }
      ]
    };
  };

  // Plotly Option
  const getPlotlyData = () => {
    if (!chartData) return [];
    return [{
      x: chartData.x,
      y: chartData.y,
      type: 'bar',
      marker: { color: '#5A4FD6' }
    }];
  };

  const plotlyLayout = {
    paper_bgcolor: 'rgba(0,0,0,0)', 
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: {color: '#cbd5e1'},
    xaxis: {gridcolor: 'rgba(255,255,255,0.1)'},
    yaxis: {gridcolor: 'rgba(255,255,255,0.1)'},
    margin: { b: 40, t: 40, l: 40, r: 20 },
    hovermode: 'closest',
    autosize: true
  };

  if (!dataset) return null;

  return (
    <div className="mt-5 border-top border-secondary pt-5" id="bi-section">
      <Row className="mb-4">
        <Col className="d-flex justify-content-between align-items-center">
          <div>
            <h3 className="fw-bold m-0">BI Visualization: <span className="text-primary">{dataset.dataset_name}</span></h3>
            <p className="text-muted mt-2 mb-0">Powered by Plotly and Apache ECharts</p>
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
          <Col md={6}>
            <Card className="glass-card h-100">
              <Card.Body className="d-flex flex-column">
                <div className="d-flex align-items-center mb-4">
                  <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '15px' }}>
                    <span style={{ color: '#000000', fontWeight: 'bold', fontSize: '1.2rem' }}>P</span>
                  </div>
                  <h4 className="mb-0 text-white">Plotly Dashboard</h4>
                </div>
                
                <div className="flex-grow-1" style={{ minHeight: '400px' }}>
                  <Plot
                    data={getPlotlyData()}
                    layout={plotlyLayout}
                    useResizeHandler={true}
                    style={{ width: "100%", height: "100%", minHeight: "400px" }}
                    config={{ displayModeBar: true, displaylogo: false }}
                  />
                </div>
              </Card.Body>
            </Card>
          </Col>

          <Col md={6}>
            <Card className="glass-card h-100">
              <Card.Body className="d-flex flex-column">
                <div className="d-flex align-items-center mb-4">
                  <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#E32D33', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '15px' }}>
                    <span style={{ color: '#ffffff', fontWeight: 'bold', fontSize: '1.2rem' }}>E</span>
                  </div>
                  <h4 className="mb-0 text-white">Apache ECharts Report</h4>
                </div>
                
                <div className="flex-grow-1" style={{ minHeight: '400px' }}>
                  <ReactECharts
                    option={getEChartsOption()}
                    style={{ height: '400px', width: '100%' }}
                    opts={{ renderer: 'svg' }}
                  />
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      ) : null}
    </div>
  );
}
