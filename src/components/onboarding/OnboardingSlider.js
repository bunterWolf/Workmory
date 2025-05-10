import React from 'react';
import { useTranslation } from 'react-i18next';
import './OnboardingSlider.css';

// Interface für die Props des OnboardingSlider
// interface OnboardingSliderProps {
//   steps: React.ReactNode[];
//   currentStep: number;
//   setCurrentStep: (step: number) => void;
//   onComplete: () => void;
//   permissions: {
//     accessibility: boolean;
//     screenRecording: boolean;
//   };
// }

/**
 * Der OnboardingSlider zeigt die Onboarding-Schritte an und stellt die Navigation bereit
 */
const OnboardingSlider = ({ steps, currentStep, setCurrentStep, onComplete, permissions }) => {
  const { t } = useTranslation();

  // Prüft, ob der aktuelle Schritt der letzte ist
  const isLastStep = currentStep === steps.length - 1;
  
  // Prüft, ob alle Berechtigungen erteilt wurden
  const canComplete = () => {
    if (process.platform === 'win32') {
      return true; // Windows benötigt keine Berechtigungen
    }
    return permissions.accessibility && permissions.screenRecording;
  };

  // Zurück-Button klicken
  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Weiter-Button klicken
  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  // Abschluss-Button klicken
  const handleComplete = () => {
    if (isLastStep && canComplete()) {
      onComplete();
    }
  };

  // Erstellt die Punkt-Indikatoren basierend auf der Anzahl der Schritte
  const renderIndicators = () => {
    return (
      <div className="step-indicators">
        {steps.map((_, index) => (
          <div
            key={index}
            className={`step-indicator ${index === currentStep ? 'active' : ''}`}
            onClick={() => setCurrentStep(index)}
          />
        ))}
      </div>
    );
  };

  // Die Navigationsschaltflächen (Zurück, Weiter, Fertig)
  const renderButtons = () => {
    return (
      <div className="navigation-buttons">
        {currentStep > 0 && (
          <button className="back-button" onClick={handleBack}>
            {t('onboarding.navigation.back')}
          </button>
        )}

        {!isLastStep ? (
          <button className="next-button" onClick={handleNext}>
            {t('onboarding.navigation.next')}
          </button>
        ) : (
          <button
            className="complete-button"
            onClick={handleComplete}
            disabled={!canComplete()}
          >
            {t('onboarding.navigation.complete')}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="onboarding-slider">
      <div className="slider-container">
        <div
          className="slider-content"
          style={{
            transform: `translateX(-${currentStep * 100}%)`,
            transition: 'transform 0.3s ease-in-out'
          }}
        >
          {steps.map((step, index) => (
            <div key={index} className="slider-step">
              {step}
            </div>
          ))}
        </div>
      </div>

      <div className="slider-navigation">
        {renderIndicators()}
        {renderButtons()}
      </div>
    </div>
  );
};

export default OnboardingSlider; 