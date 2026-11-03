// Figma: Toolbar 2005:832 (left group: arrow_back 84658:1621, arrow_forward 84664:1382)
import React from 'react';
import { useTranslation } from 'react-i18next';
import Button from '../ui/Button';
import { toLocalDateKey, getYesterdayDateKey } from '../dateKey';

export default function DateNav({ selectedDate, availableDates, onDateChange }) {
  const { t } = useTranslation();

  // "Today" / "Yesterday", otherwise "Weekday, short date"
  const formatDateLabel = (dateKey) => {
    if (dateKey === toLocalDateKey()) return t('timeFormats.today');
    if (dateKey === getYesterdayDateKey()) return t('timeFormats.yesterday');
    const date = new Date(dateKey + 'T00:00:00');
    return `${t('timeFormats.weekday', { date })}, ${t('timeFormats.dateShort', { date })}`;
  };

  const currentIndex = availableDates.indexOf(selectedDate);
  const canGoPrevious = currentIndex > 0;
  const canGoNext = currentIndex < availableDates.length - 1;

  const goToPreviousDay = () => {
    if (canGoPrevious) onDateChange(availableDates[currentIndex - 1]);
  };

  const goToNextDay = () => {
    if (canGoNext) onDateChange(availableDates[currentIndex + 1]);
  };

  return (
    <div className="wm-date-nav">
      <div className="wm-date-nav-arrows">
        <Button
          icon="arrow_back"
          onClick={goToPreviousDay}
          disabled={!canGoPrevious}
          ariaLabel={t('previousDay')}
          title={t('previousDay')}
        />
        <Button
          icon="arrow_forward"
          onClick={goToNextDay}
          disabled={!canGoNext}
          ariaLabel={t('nextDay')}
          title={t('nextDay')}
        />
      </div>
      <span className="wm-date-nav-label text-m-primary">{formatDateLabel(selectedDate)}</span>
    </div>
  );
}
