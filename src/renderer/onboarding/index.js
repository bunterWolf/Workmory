import React from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import OnboardingApp from '../../components/onboarding/OnboardingApp';
import i18n from '../../i18n';

// Rendering des Onboarding
const container = document.getElementById('app');
const root = createRoot(container);
root.render(
  <I18nextProvider i18n={i18n}>
    <OnboardingApp />
  </I18nextProvider>
); 