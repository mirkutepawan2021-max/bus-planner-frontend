// src/pages/RouteManagementPage.jsx

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Container, Row, Col, Card, Form, Button, Table, Modal, Alert } from 'react-bootstrap';

export default function RouteManagementPage() {
    const [routes, setRoutes] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [currentRoute, setCurrentRoute] = useState({});
    const [isEditing, setIsEditing] = useState(false);
    const [error, setError] = useState('');

    const API_BASE_URL = 'http://localhost:4000/api/routes'; // Using your live URL

    useEffect(() => {
        fetchRoutes();
    }, []);

    const fetchRoutes = async () => {
        try {
            const response = await axios.get(API_BASE_URL);
            if (Array.isArray(response.data)) {
                setRoutes(response.data);
            } else {
                console.error("API did not return an array:", response.data);
                setRoutes([]);
            }
        } catch (err) {
            setError('Failed to fetch routes from the server. The backend may be starting up.');
            console.error("Fetch Routes Error:", err);
        }
    };

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setCurrentRoute(prevState => ({ ...prevState, [name]: type === 'checkbox' ? checked : value }));
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        setError('');
        const payload = { ...currentRoute };
        if (!payload.turnoutFromDepot) {
            payload.firstStop = '';
            payload.upTurnoutKm = 0;
            payload.downTurnoutKm = 0;
        }
        
        const method = isEditing ? 'put' : 'post';
        const url = isEditing ? `${API_BASE_URL}/${payload._id}` : API_BASE_URL;

        try {
            await axios[method](url, payload);
            fetchRoutes();
            handleCloseModal();
        } catch (err) {
            setError('Failed to save the route.');
            console.error(err);
        }
    };

    const handleEdit = (route) => {
        setCurrentRoute(route);
        setIsEditing(true);
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this route?')) {
            try {
                await axios.delete(`${API_BASE_URL}/${id}`);
                fetchRoutes();
            } catch (err) {
                setError('Failed to delete the route.');
                console.error(err);
            }
        }
    };

    const handleAddNew = () => {
        // --- THIS IS THE CHANGE: Use new fields for a new route ---
        setCurrentRoute({
            routeNumber: '', from: '', to: '', routeName: '',
            upTurnoutKm: 0, downTurnoutKm: 0, upregularKm: 0, downregularKm: 0,
            uptimePerKm: 0, downtimePerKm: 0, // Replaced timePerKm
            turnoutFromDepot: false, firstStop: ''
        });
        // --- END OF CHANGE ---
        setIsEditing(false);
        setShowModal(true);
    };

    const handleCloseModal = () => { setShowModal(false); setError(''); };

    return (
        <Container fluid className="mt-4">
            <Card>
                <Card.Header as="h4" className="d-flex justify-content-between align-items-center">
                    Manage Routes
                    <Button onClick={handleAddNew}>+ Add New Route</Button>
                </Card.Header>
                <Card.Body>
                    {error && <Alert variant="danger" onClose={() => setError('')} dismissible>{error}</Alert>}
                    <Table striped bordered hover responsive>
                        <thead>
                            <tr>
                                <th>Route No.</th>
                                <th>From</th>
                                <th>To</th>
                                <th>Name</th>
                                {/* --- THIS IS THE CHANGE: Updated table headers --- */}
                                <th>Up Time/Km</th>
                                <th>Down Time/Km</th>
                                {/* --- END OF CHANGE --- */}
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {Array.isArray(routes) && routes.map(route => (
                                <tr key={route._id}>
                                    <td>{route.routeNumber}</td>
                                    <td>{route.from}</td>
                                    <td>{route.to}</td>
                                    <td>{route.routeName}</td>
                                    {/* --- THIS IS THE CHANGE: Updated table data cells --- */}
                                    <td>{route.uptimePerKm}</td>
                                    <td>{route.downtimePerKm}</td>
                                    {/* --- END OF CHANGE --- */}
                                    <td>
                                        <Button variant="info" size="sm" onClick={() => handleEdit(route)}>Edit</Button>{' '}
                                        <Button variant="danger" size="sm" onClick={() => handleDelete(route._id)}>Delete</Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                </Card.Body>
            </Card>

            <Modal show={showModal} onHide={handleCloseModal}>
                <Modal.Header closeButton>
                    <Modal.Title>{isEditing ? 'Edit Route' : 'Add New Route'}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form onSubmit={handleFormSubmit}>
                        <Form.Group className="mb-3"><Form.Label>Route Number</Form.Label><Form.Control type="text" name="routeNumber" value={currentRoute.routeNumber || ''} onChange={handleInputChange} required /></Form.Group>
                        <Form.Group className="mb-3"><Form.Label>Route Name</Form.Label><Form.Control type="text" name="routeName" value={currentRoute.routeName || ''} onChange={handleInputChange} required /></Form.Group>
                        <Form.Group className="mb-3"><Form.Label>From</Form.Label><Form.Control type="text" name="from" value={currentRoute.from || ''} onChange={handleInputChange} required /></Form.Group>
                        <Form.Group className="mb-3"><Form.Label>To</Form.Label><Form.Control type="text" name="to" value={currentRoute.to || ''} onChange={handleInputChange} required /></Form.Group>
                        <Form.Group className="mb-3"><Form.Label>Up Regular Km</Form.Label><Form.Control type="number" name="upregularKm" value={currentRoute.upregularKm || 0} onChange={handleInputChange} /></Form.Group>
                        <Form.Group className="mb-3"><Form.Label>Down Regular Km</Form.Label><Form.Control type="number" name="downregularKm" value={currentRoute.downregularKm || 0} onChange={handleInputChange} /></Form.Group>
                        
                        {/* --- THIS IS THE CHANGE: Updated form fields --- */}
                        <Form.Group className="mb-3">
                            <Form.Label>Up Time Per Km (mins)</Form.Label>
                            <Form.Control type="number" name="uptimePerKm" value={currentRoute.uptimePerKm || 0} onChange={handleInputChange} />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>Down Time Per Km (mins)</Form.Label>
                            <Form.Control type="number" name="downtimePerKm" value={currentRoute.downtimePerKm || 0} onChange={handleInputChange} />
                        </Form.Group>
                        {/* --- END OF CHANGE --- */}

                        <Form.Check type="switch" label="Turnout from Depot" name="turnoutFromDepot" checked={currentRoute.turnoutFromDepot || false} onChange={handleInputChange} className="mb-3" />
                        {currentRoute.turnoutFromDepot && (
                            <>
                                <Form.Group className="mb-3"><Form.Label>First Stop</Form.Label><Form.Control type="text" name="firstStop" value={currentRoute.firstStop || ''} onChange={handleInputChange} /></Form.Group>
                                <Form.Group className="mb-3"><Form.Label>Up Turnout Km</Form.Label><Form.Control type="number" name="upTurnoutKm" value={currentRoute.upTurnoutKm || 0} onChange={handleInputChange} /></Form.Group>
                                <Form.Group className="mb-3"><Form.Label>Down Turnout Km</Form.Label><Form.Control type="number" name="downTurnoutKm" value={currentRoute.downTurnoutKm || 0} onChange={handleInputChange} /></Form.Group>
                            </>
                        )}
                        <Button variant="secondary" onClick={handleCloseModal}>Cancel</Button>
                        <Button variant="primary" type="submit" className="ms-2">Save Route</Button>
                    </Form>
                </Modal.Body>
            </Modal>
        </Container>
    );
}
