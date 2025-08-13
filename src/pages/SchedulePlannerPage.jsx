// src/pages/SchedulePlannerPage.jsx

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Container, Card, Form, Button, Row, Col, Alert, Table } from 'react-bootstrap';

export default function SchedulePlannerPage() {
    const { routeId } = useParams();
    const [route, setRoute] = useState(null);
    const [generatedSchedule, setGeneratedSchedule] = useState([]);
    const [error, setError] = useState('');
    
    // State for the new form fields
    const [scheduleParams, setScheduleParams] = useState({
        fleetSize: 1,
        batteryRangeHours: 8,
        chargingTimeHours: 4,
        serviceStartTime: '06:00'
    });

    const API_BASE_URL = 'http://localhost:4000/api/routes';

    useEffect(() => {
        const fetchRouteDetails = async () => {
            try {
                const response = await axios.get(`${API_BASE_URL}/${routeId}`);
                setRoute(response.data);
            } catch (err) {
                setError('Failed to load route details. Please go back and try again.');
            }
        };
        if (routeId) {
            fetchRouteDetails();
        }
    }, [routeId]);
    
    // Handler for the new form
    const handleParamChange = (e) => {
        const { name, value } = e.target;
        setScheduleParams(prevState => ({ ...prevState, [name]: value }));
    };

    const handleGenerateSchedule = (e) => {
        e.preventDefault(); // Prevent form submission from reloading the page
        setError('');
        setGeneratedSchedule([]);
        const roundTripMinutes = (route.upregularKm + route.downregularKm) * route.timePerKm;
        const roundTripHours = roundTripMinutes / 60;

        if (roundTripHours <= 0) {
            setError('Cannot generate schedule. Round trip time must be greater than zero.');
            return;
        }
        const tripsPerCharge = Math.floor(scheduleParams.batteryRangeHours / roundTripHours);
        if (tripsPerCharge < 1) {
            setError('Battery range is too low for even one round trip.');
            return;
        }
        const newSchedule = [];
        const [startHour, startMinute] = scheduleParams.serviceStartTime.split(':').map(Number);
        
        for (let i = 0; i < scheduleParams.fleetSize; i++) {
            const busNumber = i + 1;
            const departureOffsetHours = i * roundTripHours;
            const departureTime = new Date();
            departureTime.setHours(startHour, startMinute, 0, 0);
            departureTime.setMinutes(departureTime.getMinutes() + Math.round(departureOffsetHours * 60));
            const operatingDurationHours = tripsPerCharge * roundTripHours;
            const chargeStartTime = new Date(departureTime.getTime() + Math.round(operatingDurationHours * 60 * 60 * 1000));
            newSchedule.push({
                busNumber,
                departureTime: departureTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                tripsPerCharge,
                chargeStartTime: chargeStartTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            });
        }
        setGeneratedSchedule(newSchedule);
    };

    if (error && !route) return <Container className="my-4"><Alert variant="danger">{error}</Alert></Container>;
    if (!route) return <Container className="my-4"><p>Loading route details...</p></Container>;

    return (
        <Container className="my-4">
            <Row>
                <Col lg={4}>
                    <Card className="shadow-sm">
                        <Card.Header as="h5">Planner for: {route.routeName}</Card.Header>
                        <Card.Body>
                            <Form onSubmit={handleGenerateSchedule}>
                                <Form.Group className="mb-3"><Form.Label>Fleet Size</Form.Label><Form.Control type="number" name="fleetSize" value={scheduleParams.fleetSize} onChange={handleParamChange} /></Form.Group>
                                <Form.Group className="mb-3"><Form.Label>Battery Range (Hours)</Form.Label><Form.Control type="number" name="batteryRangeHours" value={scheduleParams.batteryRangeHours} onChange={handleParamChange} /></Form.Group>
                                <Form.Group className="mb-3"><Form.Label>Charging Time (Hours)</Form.Label><Form.Control type="number" name="chargingTimeHours" value={scheduleParams.chargingTimeHours} onChange={handleParamChange} /></Form.Group>
                                <Form.Group className="mb-3"><Form.Label>Service Start Time</Form.Label><Form.Control type="time" name="serviceStartTime" value={scheduleParams.serviceStartTime} onChange={handleParamChange} /></Form.Group>
                                <Button variant="success" type="submit" className="w-100">Generate Schedule</Button>
                            </Form>
                        </Card.Body>
                    </Card>
                </Col>
                <Col lg={8}>
                    <Card className="shadow-sm">
                        <Card.Header as="h5">Generated Schedule</Card.Header>
                        <Card.Body>
                            {error && <Alert variant="danger">{error}</Alert>}
                            {generatedSchedule.length > 0 ? (
                                <Table striped bordered hover responsive>
                                    <thead><tr><th>Bus #</th><th>Departure Time</th><th>Trips Before Charging</th><th>Must Start Charging By</th></tr></thead>
                                    <tbody>{generatedSchedule.map(item => (<tr key={item.busNumber}><td>{item.busNumber}</td><td>{item.departureTime}</td><td>{item.tripsPerCharge}</td><td>{item.chargeStartTime}</td></tr>))}</tbody>
                                </Table>
                            ) : (
                                <p>Enter parameters and click "Generate Schedule" to see the plan.</p>
                            )}
                        </Card.Body>
                    </Card>
                </Col>
            </Row>
        </Container>
    );
}
