// Figma: SettingRow 84699:2276
import React from 'react';
import './SettingRow.css';

// One settings entry: optional leading control (e.g. a Toggle), title and description,
// plus optional extra content below the description (children).
export default function SettingRow({ control, title, description, children }) {
  return (
    <div className="wm-setting-row">
      {control}
      <div className="wm-setting-row-text">
        <div className="wm-setting-row-title text-m-primary">{title}</div>
        {description && <div className="wm-setting-row-description text-m-default">{description}</div>}
        {children}
      </div>
    </div>
  );
}
