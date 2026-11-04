// Figma: SettingRow 84699:2276
import React from 'react';
import './SettingRow.css';

// One settings entry: optional leading control (e.g. a Toggle), title and description,
// plus optional extra content below the description (children).
// trailing: a control on the title line, right-aligned (e.g. a SegmentedControl).
// alignWithControls: keeps the empty leading column so the title lines up with Toggle rows.
export default function SettingRow({ control, title, description, trailing, alignWithControls = false, children }) {
  const titleEl = <div className="wm-setting-row-title text-m-primary">{title}</div>;
  return (
    <div className="wm-setting-row">
      {control || (alignWithControls && <span className="wm-setting-row-control-slot" aria-hidden="true" />)}
      <div className="wm-setting-row-text">
        {trailing ? (
          <div className="wm-setting-row-title-line">
            {titleEl}
            {trailing}
          </div>
        ) : titleEl}
        {description && <div className="wm-setting-row-description text-m-default">{description}</div>}
        {children}
      </div>
    </div>
  );
}
