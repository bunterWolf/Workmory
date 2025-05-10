import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ipcRenderer } from 'electron';
import OnboardingSlider from './OnboardingSlider';
import WelcomeStep from './steps/WelcomeStep';
import PrivacyStep from './steps/PrivacyStep';
import AccessibilityStep from './steps/AccessibilityStep';
import ScreenRecordingStep from './steps/ScreenRecordingStep';
import CompletionStep from './steps/CompletionStep';
import './OnboardingApp.css';

const OnboardingApp = () => {
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState(0);
  const [permissions, setPermissions] = useState({
    accessibility: false,
    screenRecording: false
  });
  const [loading, setLoading] = useState(true);
  const [isWindows, setIsWindows] = useState(false);

  // Überprüfe Berechtigungen beim Start
  useEffect(() => {
    const checkPermissions = async () => {
      setLoading(true);
      try {
        const platform = await ipcRenderer.invoke('onboarding:get-platform');
        setIsWindows(platform === 'win32');

        const permissionStatus = await ipcRenderer.invoke('onboarding:check-permissions');
        setPermissions(permissionStatus);
      } catch (error) {
        console.error('Fehler beim Überprüfen der Berechtigungen:', error);
      } finally {
        setLoading(false);
      }
    };
    
    // IPC-Handler für Berechtigungsänderungen registrieren
    const handlePermissionChange = (_, permissionType, status) => {
      setPermissions(prev => ({
        ...prev,
        [permissionType]: status
      }));
    };
    
    ipcRenderer.on('onboarding:permission-changed', handlePermissionChange);
    checkPermissions();
    
    return () => {
      ipcRenderer.removeListener('onboarding:permission-changed', handlePermissionChange);
    };
  }, []);

  // Automatischer Übergang nach Berechtigungserteilung
  useEffect(() => {
    if (currentStep === 2 && permissions.accessibility) {
      // Wenn auf dem Accessibility-Schritt und Berechtigung erteilt, gehe zu Screen Recording
      setTimeout(() => setCurrentStep(3), 1000);
    } else if (currentStep === 3 && permissions.screenRecording) {
      // Wenn auf dem Screen Recording-Schritt und Berechtigung erteilt, gehe zum Abschluss
      setTimeout(() => setCurrentStep(4), 1000);
    }
  }, [permissions, currentStep]);

  // Funktion zum Anfordern von Berechtigungen
  const requestPermission = async (permissionType) => {
    try {
      await ipcRenderer.invoke(`onboarding:request-${permissionType}`);
      
      // Die Aktualisierung des Berechtigungsstatus erfolgt über den Event-Handler
    } catch (error) {
      console.error(`Fehler beim Anfordern der ${permissionType}-Berechtigung:`, error);
    }
  };

  // Onboarding abschließen und Hauptanwendung starten
  const completeOnboarding = async () => {
    await ipcRenderer.invoke('onboarding:complete');
  };

  // Erzeuge die Schritte basierend auf der Plattform
  const getSteps = () => {
    const steps = [
      <WelcomeStep />,
      <PrivacyStep />
    ];
    
    // Füge plattformspezifische Berechtigungsschritte hinzu
    if (!isWindows) {
      steps.push(
        <AccessibilityStep 
          granted={permissions.accessibility}
          onRequest={() => requestPermission('accessibility')}
          openSettings={() => ipcRenderer.invoke('onboarding:open-accessibility-settings')}
        />,
        <ScreenRecordingStep 
          granted={permissions.screenRecording}
          onRequest={() => requestPermission('screen-recording')}
          openSettings={() => ipcRenderer.invoke('onboarding:open-screen-recording-settings')}
        />
      );
    }
    
    steps.push(<CompletionStep />);
    return steps;
  };

  const steps = getSteps();
  
  if (loading) {
    return (
      <div className="onboarding-loading">
        <p>{t('onboarding.loading')}</p>
      </div>
    );
  }

  return (
    <div className="onboarding-app">
      <OnboardingSlider
        steps={steps}
        currentStep={currentStep}
        setCurrentStep={setCurrentStep}
        onComplete={completeOnboarding}
        permissions={permissions}
      />
    </div>
  );
};

export default OnboardingApp; 