import React from 'react';

const Header = ({ date, onPrevious, onNext, isTracking, onToggleTracking }) => {
  return (
    <div className="header">
      <div className="date-navigation">
        <button onClick={onPrevious}>&larr;</button>
        <h2>{date}</h2>
        <button onClick={onNext}>&rarr;</button>
      </div>
      
      <div className="tracking-controls">
        <button onClick={onToggleTracking}>
          {isTracking ? 'Pause Tracking' : 'Start Tracking'}
        </button>
      </div>
    </div>
  );
};

export default Header; 