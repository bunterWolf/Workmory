// Figma: arrow_back 84658:1621, arrow_forward 84664:1382, more_horiz_20 84686:535,
// pause_circle 84678:1461
import React from 'react';
import arrowBack from '../../assets/icons/arrow_back.svg';
import arrowForward from '../../assets/icons/arrow_forward.svg';
import moreHoriz20 from '../../assets/icons/more_horiz_20.svg';
import pauseCircle from '../../assets/icons/pause_circle.svg';
import './Icon.css';

const ICONS = {
  arrow_back: arrowBack,
  arrow_forward: arrowForward,
  more_horiz_20: moreHoriz20,
  pause_circle: pauseCircle,
};

// The SVG is used as a mask, so the icon takes the current text color.
// size is the Figma root size of the icon (all current icons are 20).
export default function Icon({ name, size = 20, className = '' }) {
  const url = ICONS[name];
  if (!url) return null;
  return (
    <span
      className={`wm-icon ${className}`.trim()}
      style={{ '--wm-icon-url': `url("${url}")`, width: size, height: size }}
      aria-hidden="true"
    />
  );
}
