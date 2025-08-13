// src/components/DutySummary.jsx

import React from 'react';
import { Table } from 'react-bootstrap';

const DutySummary = ({ summaryData, route }) => {
  if (!summaryData || summaryData.length === 0) return null;

  return (
    <div className="printable-area">
      <div className="text-center mb-3">
        <h6>Transport Service, Thane Municipal Corporation, Thane</h6>
        <p className="mb-0">एकत्रित बस शिफ्ट ड्युटी सारांश</p>
        {route && <p className="text-muted small">{`${route.from} to ${route.to}, Route No. ${route.routeNumber} (Schedule)`}</p>}
      </div>
      <Table striped bordered responsive>
        <thead className="table-dark">
          <tr>
            <th>Sr. No.</th>
            <th>Bus/Shift No.</th>
            <th>Reporting Time</th>
            <th>Bus Boarding Time</th>
            <th>Work Start Time</th>
            <th>Work End Time</th>
            <th>Total Shift Hours</th>
          </tr>
        </thead>
        <tbody>
          {summaryData.map((row, index) => (
            <tr key={index}>
              <td>{row.isSecondRow ? '' : index + 1 - (row.shiftNo > 1 ? (row.busNo - 1) : 0)}</td>
              <td>{row.isSecondRow ? '' : `${row.busNo} / ${row.shiftNo}`}</td>
              <td>{row.callingTime}</td>
              <td>{row.shiftStart}</td>
              <td>{row.workStart}</td>
              <td>{row.workEnd}</td>
              <td>{row.isSecondRow ? '' : row.totalHours}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
};

export default DutySummary;
