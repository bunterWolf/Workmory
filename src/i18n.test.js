jest.mock('electron', () => ({ remote: { app: { getLocale: () => 'de' } } }));

import i18n from './i18n';

const phrases = (lng) => i18n.getResource(lng, 'translation', 'trackingPhrases');

describe('trackingPhrases', () => {
  it('has the same number of phrases in every language', () => {
    expect(phrases('de').length).toBeGreaterThan(1);
    expect(phrases('en')).toHaveLength(phrases('de').length);
  });

  // A first-time user must immediately understand that tracking is running.
  it('starts with a plain tracking phrase', () => {
    expect(phrases('de')[0]).toBe('Tracking läuft');
    expect(phrases('en')[0]).toBe('Tracking');
  });
});
