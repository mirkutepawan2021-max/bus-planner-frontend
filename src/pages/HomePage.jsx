// src/pages/HomePage.jsx

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Container, Row, Col, Card, Form, Button, Modal,
  InputGroup, Spinner, Table
} from 'react-bootstrap';
import generateFullDayTableData from '../utils/scheduler.jsx';
import LogSheet from '../components/LogSheet';
import DutySummary from '../components/DutySummary';

export default function HomePage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [peakHours, setPeakHours] = useState([]);
  const [reducedHours, setReducedHours] = useState([]);
  const [callingTime, setCallingTime] = useState('04:00');
  const [numberOfBuses, setNumberOfBuses] = useState(2);
  const [breakLocation, setBreakLocation] = useState('');
  const [scheduleData, setScheduleData] = useState({ headers: [], rows: [], allSchedules: [], dutySummaryData: [] });

  const [showPrintModal, setShowPrintModal] = useState(false);
  const [modalContent, setModalContent] = useState(null);

  useEffect(() => {
    if (selectedRoute) {
      setPeakHours(selectedRoute.peakHours || []);
      setReducedHours(selectedRoute.reducedHours || []);
      setBreakLocation(selectedRoute.from);
      setScheduleData({ headers: [], rows: [], allSchedules: [], dutySummaryData: [] });
    } else {
      setOptions([]);
    }
  }, [selectedRoute]);
  
  useEffect(() => {
    const fetchRoutes = async () => {
      if (searchTerm.length < 2) {
        setOptions([]);
        return;
      }
      setLoading(true);
      try {
        const response = await axios.get('http://localhost:4000/api/routes', { params: { search: searchTerm } });
        setOptions(response.data);
      } catch (error) { console.error('Failed to fetch routes:', error); setOptions([]); }
      setLoading(false);
    };

    const timer = setTimeout(() => { fetchRoutes(); }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleScheduleClick = () => {
    if (!selectedRoute) return;
    const scheduleInputs = { callingTime, numberOfBuses, breakLocation, route: selectedRoute, peakHours, reducedHours };
    const generatedData = generateFullDayTableData(scheduleInputs);
    setScheduleData(generatedData);
  };

  const handleOpenPrintModal = (component) => { setModalContent(component); setShowPrintModal(true); };
  const handlePrint = () => { window.print(); };

  const handlePeakHourChange = (index, field, value) => { const newPeakHours = [...peakHours]; newPeakHours[index][field] = value; setPeakHours(newPeakHours); };
  const handleAddPeakHour = () => { setPeakHours([...peakHours, { startTime: '', endTime: '', extraTime: 10, bus: 'All' }]); };
  const handleRemovePeakHour = (index) => { setPeakHours(peakHours.filter((_, i) => i !== index)); };

  const handleReducedHourChange = (index, field, value) => { const newReducedHours = [...reducedHours]; newReducedHours[index][field] = value; setReducedHours(newReducedHours); };
  const handleAddReducedHour = () => { setReducedHours([...reducedHours, { startTime: '', endTime: '', reducedTime: 5, bus: 'All' }]); };
  const handleRemoveReducedHour = (index) => { setReducedHours(reducedHours.filter((_, i) => i !== index)); };

  return (
    <Container className="my-4">
      <div className="text-center mb-5">
        <h1>Bus Route Planner</h1>
        <p className="text-muted">A professional tool for generating daily bus schedules</p>
      </div>

      <Card className="mb-4 shadow-sm">
        <Card.Header className="fw-bold">Route Selection</Card.Header>
        <Card.Body>
          <Form.Group>
            <Form.Label>Search for a route by number or name</Form.Label>
            <InputGroup>
              <Form.Control type="text" placeholder="e.g., '101' or 'Thane Station'" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} onFocus={() => setSelectedRoute(null)} />
              {loading && <InputGroup.Text><Spinner animation="border" size="sm" /></InputGroup.Text>}
            </InputGroup>
          </Form.Group>
          {options.length > 0 && !selectedRoute && (
            <div className="list-group mt-2">
              {options.map(option => (
                <button type="button" key={option._id} className="list-group-item list-group-item-action" onClick={() => { setSelectedRoute(option); setSearchTerm(`${option.routeNumber} - ${option.from} to ${option.to}`); }}>
                  {option.routeNumber} - {option.from} to {option.to}
                </button>
              ))}
            </div>
          )}
        </Card.Body>
      </Card>

      {selectedRoute && (
        <Card className="mb-4 shadow-sm">
          <Card.Header as="h5" className="fw-bold">{selectedRoute.routeNumber}: {selectedRoute.routeName}</Card.Header>
          <Card.Body>
            <h6 className="card-subtitle mb-3 text-primary">Schedule Inputs</h6>
            <Row className="g-3 mb-4">
              <Col md={4}><Form.Group><Form.Label>Calling Time</Form.Label><Form.Control required type="time" value={callingTime} onChange={e => setCallingTime(e.target.value)} /></Form.Group></Col>
              <Col md={4}><Form.Group><Form.Label>Number of Buses</Form.Label><Form.Control required type="number" min="1" value={numberOfBuses} onChange={e => setNumberOfBuses(Number(e.target.value))} /></Form.Group></Col>
              <Col md={4}><Form.Group><Form.Label>Break Location</Form.Label><Form.Select required value={breakLocation} onChange={e => setBreakLocation(e.target.value)}><option value={selectedRoute.from}>{selectedRoute.from}</option><option value={selectedRoute.to}>{selectedRoute.to}</option></Form.Select></Form.Group></Col>
            </Row>

            <hr />
            <h6 className="card-subtitle my-3 text-primary">Peak Hours Management</h6>
            {peakHours.map((hour, index) => (
              <Card key={index} className="mb-2 bg-light"><Card.Body className="p-2"><Row className="g-2 align-items-center">
                <Col xs={12} md={3}><Form.Control placeholder="Start Time" type="time" value={hour.startTime || ''} onChange={(e) => handlePeakHourChange(index, 'startTime', e.target.value)} /></Col>
                <Col xs={12} md={3}><Form.Control placeholder="End Time" type="time" value={hour.endTime || ''} onChange={(e) => handlePeakHourChange(index, 'endTime', e.target.value)} /></Col>
                <Col xs={12} md={2}><Form.Control placeholder="Extra (min)" type="number" value={hour.extraTime || 0} onChange={(e) => handlePeakHourChange(index, 'extraTime', e.target.value)} /></Col>
                <Col xs={10} md={3}><Form.Select value={hour.bus || 'All'} onChange={(e) => handlePeakHourChange(index, 'bus', e.target.value)}><option value="All">All Buses</option>{Array.from({ length: numberOfBuses }, (_, i) => i + 1).map(n => <option key={n} value={n}>Bus {n}</option>)}</Form.Select></Col>
                <Col xs={2} md={1} className="d-flex"><Button variant="danger" size="sm" onClick={() => handleRemovePeakHour(index)}>&times;</Button></Col>
              </Row></Card.Body></Card>
            ))}
            <Button variant="secondary" size="sm" onClick={handleAddPeakHour}>+ Add Peak Hour</Button>

            <hr />
            <h6 className="card-subtitle my-3 text-primary">Reduced Hours Management</h6>
            {reducedHours.map((hour, index) => (
               <Card key={index} className="mb-2 bg-light"><Card.Body className="p-2"><Row className="g-2 align-items-center">
                <Col xs={12} md={3}><Form.Control placeholder="Start Time" type="time" value={hour.startTime || ''} onChange={(e) => handleReducedHourChange(index, 'startTime', e.target.value)} /></Col>
                <Col xs={12} md={3}><Form.Control placeholder="End Time" type="time" value={hour.endTime || ''} onChange={(e) => handleReducedHourChange(index, 'endTime', e.target.value)} /></Col>
                <Col xs={12} md={2}><Form.Control placeholder="Reduced (min)" type="number" value={hour.reducedTime || 0} onChange={(e) => handleReducedHourChange(index, 'reducedTime', e.target.value)} /></Col>
                <Col xs={10} md={3}><Form.Select value={hour.bus || 'All'} onChange={(e) => handleReducedHourChange(index, 'bus', e.target.value)}><option value="All">All Buses</option>{Array.from({ length: numberOfBuses }, (_, i) => i + 1).map(n => <option key={n} value={n}>Bus {n}</option>)}</Form.Select></Col>
                <Col xs={2} md={1} className="d-flex"><Button variant="danger" size="sm" onClick={() => handleRemoveReducedHour(index)}>&times;</Button></Col>
              </Row></Card.Body></Card>
            ))}
            <Button variant="secondary" size="sm" onClick={handleAddReducedHour}>+ Add Reduced Hour</Button>
            
            {/* --- THIS IS THE ONLY CHANGE --- */}
            <div className="d-flex justify-content-end mt-4">
              <Button variant="primary" onClick={handleScheduleClick}>Generate Schedule</Button>
            </div>
            
          </Card.Body>
        </Card>
      )}

      {scheduleData.rows.length > 0 && (
        <Card className="mb-4 shadow-sm">
          <Card.Header as="h5" className="fw-bold">Detailed Duty Roster</Card.Header>
          <Card.Body>
            <Table responsive striped bordered hover>
              <thead><tr>{scheduleData.headers.map(h => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>{scheduleData.rows.map((row, rIndex) => (
                <tr key={rIndex}>{scheduleData.headers.map(h => <td key={h}>{row[h] || '--'}</td>)}</tr>
              ))}</tbody>
            </Table>
          </Card.Body>
        </Card>
      )}
      
      {scheduleData.dutySummaryData.length > 0 && (
        <Card className="mb-4 shadow-sm">
          <Card.Header as="h5" className="fw-bold">Consolidated Duty Summary</Card.Header>
          <Card.Body>
            <DutySummary summaryData={scheduleData.dutySummaryData} route={selectedRoute} />
            <Button className="mt-3" variant="outline-secondary" onClick={() => handleOpenPrintModal(<DutySummary summaryData={scheduleData.dutySummaryData} route={selectedRoute} />)}>
              Print Duty Summary
            </Button>
          </Card.Body>
        </Card>
      )}

      {scheduleData.allSchedules.length > 0 && (
        <Card className="shadow-sm">
          <Card.Header as="h5" className="fw-bold">Printable Log Sheets</Card.Header>
          <Card.Body>
            <Row>
              {scheduleData.allSchedules.map((shiftData) => (
                <Col key={shiftData.name} xs="auto" className="mb-2">
                  <Button variant="outline-primary" onClick={() => handleOpenPrintModal(<LogSheet shiftData={shiftData} />)}>
                    Log Sheet for {shiftData.name}
                  </Button>
                </Col>
              ))}
            </Row>
          </Card.Body>
        </Card>
      )}
      
      <Modal show={showPrintModal} onHide={() => setShowPrintModal(false)} size="xl" centered>
        <Modal.Header closeButton>
          <Modal.Title>Print View</Modal.Title>
        </Modal.Header>
        <Modal.Body>{modalContent}</Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowPrintModal(false)}>Close</Button>
          <Button variant="primary" onClick={handlePrint}>Print</Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
}