// Figma: .Event-Master, variant Tracking 84722:2213 (title text)
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import nextPhraseIndex from './nextPhraseIndex';
import './TrackingStatusText.css';

const PHRASE_DURATION_MS = 30000;
// Mirrors --tl-status-fade in TrackingStatusText.css.
const FADE_MS = 600;

// Title of the running block: a phrase that calmly changes. Always opens with the first,
// plain phrase. Timers drive the change because CSS animation events stall without
// rendered frames, for example while the window is covered.
export default function TrackingStatusText() {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  const [isFading, setIsFading] = useState(false);
  const phrases = t('trackingPhrases', { returnObjects: true });
  const phraseCount = phrases.length;

  useEffect(() => {
    const fadeOut = setTimeout(() => setIsFading(true), PHRASE_DURATION_MS - FADE_MS);
    const change = setTimeout(() => {
      setIndex(nextPhraseIndex(index, phraseCount));
      setIsFading(false);
    }, PHRASE_DURATION_MS);
    return () => {
      clearTimeout(fadeOut);
      clearTimeout(change);
    };
  }, [index, phraseCount]);

  return (
    <span className={`wm-timeline-event-title wm-tracking-status text-m-primary${isFading ? ' wm-tracking-status--fading' : ''}`}>
      {phrases[index]}
    </span>
  );
}
