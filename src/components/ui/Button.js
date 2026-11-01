// Figma: Button 84658:1616 (states: Hover 84658:1623, Pressed 84734:3006, Disabled 84734:2997)
import React from 'react';
import Icon from './Icon';
import './Button.css';

export default function Button({ icon, label, onClick, disabled = false, ariaLabel, title, className = '' }) {
  return (
    <button
      type="button"
      className={`wm-button ${className}`.trim()}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      title={title}
    >
      {icon && <Icon name={icon} size={20} />}
      {label && <span className="wm-button-label text-m-primary">{label}</span>}
    </button>
  );
}
