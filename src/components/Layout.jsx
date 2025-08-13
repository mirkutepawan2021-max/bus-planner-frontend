// src/Layout.jsx

import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { Navbar, Container, Button } from 'react-bootstrap';

export default function Layout() {
  return (
    <>
      <Navbar bg="light" variant="light" expand="lg" className="shadow-sm">
        <Container fluid>
          <Navbar.Brand as={Link} to="/" className="fw-bold">
            Bus Route Planner
          </Navbar.Brand>
          <Link to="/manage-routes">
            <Button variant="outline-primary">Manage Routes</Button>
          </Link>
        </Container>
      </Navbar>
      
      <main>
        <Outlet />
      </main>
    </>
  );
}
