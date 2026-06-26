import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Icon from './Icons';
import './Header.css';

const Header = ({
  selectedDate,
  availableDates,
  onDateChange,
  isTracking,
  onToggleTracking,
  isMockData,
  aggregationInterval = 15,
  onIntervalChange
}) => {
  const { t } = useTranslation();

  // Main label: Today / Yesterday / weekday name
  const formatDateMain = (dateKey) => {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = yesterday.toISOString().split('T')[0];

    if (dateKey === today) return t('timeFormats.today');
    if (dateKey === yesterdayKey) return t('timeFormats.yesterday');
    const date = new Date(dateKey + 'T00:00:00');
    return t('timeFormats.weekday', { date });
  };

  // Sub label: formatted short date, e.g. "24. Juni"
  const formatDateSub = (dateKey) => {
    const date = new Date(dateKey + 'T00:00:00');
    return t('timeFormats.dateShort', { date });
  };

  const goToPreviousDay = () => {
    const currentIndex = availableDates.indexOf(selectedDate);
    if (currentIndex > 0) {
      onDateChange(availableDates[currentIndex - 1]);
    }
  };

  const goToNextDay = () => {
    const currentIndex = availableDates.indexOf(selectedDate);
    if (currentIndex < availableDates.length - 1) {
      onDateChange(availableDates[currentIndex + 1]);
    }
  };

  const canGoPrevious = availableDates.indexOf(selectedDate) > 0;
  const canGoNext = availableDates.indexOf(selectedDate) < availableDates.length - 1;

  return (
    <header className="wmk-header">
      <div className="wmk-date-nav">
        <div className="wmk-arrows">
          <button
            className="wmk-ibtn"
            onClick={goToPreviousDay}
            disabled={!canGoPrevious}
            aria-label={t('previousDay')}
            title={t('previousDay')}
          >
            <Icon.chevronLeft />
          </button>
          <button
            className="wmk-ibtn"
            onClick={goToNextDay}
            disabled={!canGoNext}
            aria-label={t('nextDay')}
            title={t('nextDay')}
          >
            <Icon.chevronRight />
          </button>
        </div>
        <div className="wmk-date">
          <span className="wmk-date-main">{formatDateMain(selectedDate)}</span>
          <span className="wmk-date-sub">{formatDateSub(selectedDate)}</span>
        </div>
      </div>

      <div className="wmk-controls">
        <IntervalDropdown
          value={aggregationInterval}
          onChange={onIntervalChange}
          options={[
            { value: 15, label: t('15min') },
            { value: 10, label: t('10min') },
            { value: 5, label: t('5min') },
          ]}
          ariaLabel={t('aggregationInterval')}
        />

        {!isMockData && (
          <button
            className={'wmk-trackbtn ' + (isTracking ? 'is-on' : 'is-off')}
            onClick={onToggleTracking}
            aria-pressed={isTracking}
            title={isTracking ? t('pauseTracking') : t('startTracking')}
          >
            {/* Both faces share one grid cell; the wider "recording" face sets
                the button width and the paused face inherits it. */}
            <span className={'wmk-trackbtn-face' + (isTracking ? '' : ' is-hidden')} aria-hidden={!isTracking}>
              <span className="wmk-rec" aria-hidden="true" />
              {t('tracking')}
            </span>
            <span className={'wmk-trackbtn-face' + (isTracking ? ' is-hidden' : '')} aria-hidden={isTracking}>
              {t('paused')}
            </span>
          </button>
        )}

        {isMockData && (
          <div className="mock-indicator">{t('mockDataMode')}</div>
        )}
      </div>
    </header>
  );
};

// Interval picker styled as a dropdown that opens a slider flyout.
function IntervalDropdown({ value, onChange, options, ariaLabel }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const values = options.map((o) => o.value);
  const idx = Math.max(0, values.indexOf(value));
  const pct = options.length > 1 ? (idx / (options.length - 1)) * 100 : 0;

  const handleChange = (next) => {
    if (onChange) onChange(Number(next));
  };

  return (
    <div className="wmk-dd">
      <button
        className="wmk-dd-btn"
        onClick={() => setOpen((o) => !o)}
        aria-label={ariaLabel}
        aria-haspopup="true"
        aria-expanded={open}
        title={ariaLabel}
      >
        <span>{value} {t('minuteUnit')}</span>
        <Icon.chevronDown size={14} />
      </button>
      {open && (
        <>
          <div className="wmk-dd-scrim" onClick={() => setOpen(false)} />
          <div className="wmk-slider-flyout">
            <div className="wmk-slider-flyout-head">
              <span className="wmk-slider-flyout-lbl">{ariaLabel}</span>
            </div>
            <input
              type="range"
              min={0}
              max={options.length - 1}
              step={1}
              value={idx}
              onChange={(e) => handleChange(values[Number(e.target.value)])}
              className="wmk-slider-input"
              style={{ '--wmk-pct': pct + '%' }}
            />
            <div className="wmk-slider-marks">
              {options.map((o) => (
                <span
                  key={o.value}
                  className={'wmk-slider-mark' + (o.value === value ? ' is-active' : '')}
                  onClick={() => handleChange(o.value)}
                >
                  {o.label}
                </span>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default Header;
