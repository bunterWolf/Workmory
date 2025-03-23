import React from 'react';

const Footer = ({ activeTime, inactiveTime, totalTime, isMockData }) => {
  return (
    <div className="footer">
      <div className="summary-stat">
        <div className="summary-value">{totalTime}</div>
        <div className="summary-label">Total Time</div>
      </div>
      
      <div className="summary-stat">
        <div className="summary-value">{activeTime}</div>
        <div className="summary-label">Active Time</div>
      </div>
      
      <div className="summary-stat">
        <div className="summary-value">{inactiveTime}</div>
        <div className="summary-label">Inactive Time</div>
      </div>
      
      {isMockData && (
        <div className="mock-data-info">
          Using sample data for development
        </div>
      )}
    </div>
  );
};

export default Footer; 