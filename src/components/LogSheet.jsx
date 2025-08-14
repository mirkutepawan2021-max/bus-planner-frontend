// src/components/LogSheet.jsx

import React from 'react';
import { Table, Row, Col } from 'react-bootstrap';

const DetailRow = ({ label, value }) => (
  <Row className="mb-1">
    <Col xs={6} className="text-end fw-bold">{label}:</Col>
    <Col xs={6}>{value}</Col>
  </Row>
);

const LogSheet = ({ shiftData }) => {
  if (!shiftData) return <p>No shift data available.</p>;

  const { name, schedule, route } = shiftData;
  
  // This part remains the same, to correctly calculate total distance from trips only.
  const trips = schedule.filter(e => e.type === 'trip');
  const totalDistance = trips.reduce((sum, trip) => sum + (trip.distance || 0), 0).toFixed(2);
  const callingTime = schedule.find(e => e.name === 'Calling Time')?.time || '--';
  const signOffTime = schedule.find(e => e.name === 'Sign Off')?.time || '--';

  return (
    <div className="printable-area p-3">
      <div className="text-center border-bottom pb-2 mb-3">
        <h4>Shift Log Sheet</h4>
        <h5>{name}</h5>
      </div>
      <Row>
        <Col md={6}>
          <DetailRow label="मार्ग क्रमांक (Route No)" value={route.routeNumber} />
          <DetailRow label="मार्गाचे नांव (Route Name)" value={route.routeName} />
        </Col>
        <Col md={6}>
          <DetailRow label="रिपोर्टिंगची वेळ (Calling Time)" value={callingTime} />
          <DetailRow label="ऑफची वेळ (Sign Off Time)" value={signOffTime} />
          <DetailRow label="एकुण किलोमीटर (Total Km)" value={totalDistance} />
        </Col>
      </Row>
      <hr />
      <Table striped bordered hover size="sm" className="mt-3">
        <thead className="table-dark">
          <tr>
            <th>फेरी क्र. (Trip)</th>
            <th>पासून (From)</th>
            <th>पर्यंत (To)</th>
            <th>जाण्याची वेळ (Start)</th>
            <th>पोहोचण्याची वेळ (End)</th>
            <th>अंंतर (Km)</th>
          </tr>
        </thead>
        <tbody>
          {/* --- DEFINITIVE FIX --- */}
          {/* We now map over the FULL schedule, not just the filtered trips */}
          {schedule.map((event, index) => {
            if (event.type === 'trip') {
              return (
                <tr key={index}>
                  <td>{event.tripNumber}</td>
                  <td>{event.startLocation}</td>
                  <td>{event.endLocation}</td>
                  <td>{event.startTime}</td>
                  <td>{event.endTime}</td>
                  <td>{(event.distance || 0).toFixed(2)}</td>
                </tr>
              );
            } else if (event.type === 'break') {
              // This is the new row for the break.
              return (
                <tr key={index} className="table-info text-center">
                  <td>Break</td>
                  <td colSpan="5">
                    {`${event.startTime} - ${event.endTime} (${Math.round(event.duration)} mins at ${event.location})`}
                  </td>
                </tr>
              );
            }
            // Ignore other event types like 'Calling Time' inside the table body
            return null;
          })}
          {/* --- END OF FIX --- */}
        </tbody>
      </Table>
    </div>
  );
};

export default LogSheet;
