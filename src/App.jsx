import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import WelcomeScreen from './components/WelcomeScreen';
import Dashboard from './components/Dashboard';
import AIAnalysis from './components/AIAnalysis';
import InsightScreen from './components/InsightScreen';
import SleepEnvironmentScreen from './components/SleepEnvironmentScreen';
import { analyzeHealth } from './services/openaiService';
import { useSmartEnvironment } from './hooks/useSmartEnvironment';
import './index.css';

const SCREENS = {
  WELCOME:   'welcome',
  DASHBOARD: 'dashboard',
  ANALYZING: 'analyzing',
  INSIGHT:   'insight',
  SLEEP_ENV: 'sleep_env',
};

const pageVariants = {
  initial: { opacity: 0, x: 40 },
  animate: { opacity: 1, x: 0 },
  exit:    { opacity: 0, x: -40 },
};

export default function App() {
  const [screen,          setScreen]          = useState(SCREENS.WELCOME);
  const [selectedPersona, setSelectedPersona] = useState(null);
  const [insight,         setInsight]         = useState(null);
  const { isActive, soundPlaying, activate, deactivate, toggleSound } = useSmartEnvironment();

  // Apply dark theme ONLY on Sleep Environment screen
  useEffect(() => {
    const body = document.body;
    body.classList.remove('dark-theme');

    if (screen === SCREENS.SLEEP_ENV) {
      body.classList.add('dark-theme');
    }
    
    return () => body.classList.remove('dark-theme');
  }, [screen]);

  const handleSelectPersona = (persona) => {
    setSelectedPersona(persona);
    setScreen(SCREENS.DASHBOARD);
  };

  const handleAnalyze = async () => {
    setScreen(SCREENS.ANALYZING);
    const result = await analyzeHealth(selectedPersona);
    setInsight(result);
    setScreen(SCREENS.INSIGHT); // No activate() here — Smart Home only in SleepEnvironmentScreen
  };

  const handleReset = () => {
    deactivate();
    setInsight(null);
    setSelectedPersona(null);
    setScreen(SCREENS.WELCOME);
  };

  const handleBackToDashboard = () => {
    deactivate();
    setScreen(SCREENS.DASHBOARD);
  };

  return (
    <div
      id="app-root"
      className="min-h-dvh w-full max-w-md mx-auto relative transition-colors duration-1000"
    >
      <AnimatePresence mode="wait">

        {screen === SCREENS.WELCOME && (
          <motion.div key="welcome" variants={pageVariants} initial="initial" animate="animate" exit="exit"
            transition={{ duration: 0.3 }}>
            <WelcomeScreen onSelectPersona={handleSelectPersona} />
          </motion.div>
        )}

        {screen === SCREENS.DASHBOARD && selectedPersona && (
          <motion.div key="dashboard" variants={pageVariants} initial="initial" animate="animate" exit="exit"
            transition={{ duration: 0.3 }}>
            <Dashboard
              persona={selectedPersona}
              onAnalyze={handleAnalyze}
              onSleepEnv={() => setScreen(SCREENS.SLEEP_ENV)}
            />
          </motion.div>
        )}

        {screen === SCREENS.ANALYZING && selectedPersona && (
          <motion.div key="analyzing" variants={pageVariants} initial="initial" animate="animate" exit="exit"
            transition={{ duration: 0.3 }}>
            <AIAnalysis persona={selectedPersona} />
          </motion.div>
        )}

        {screen === SCREENS.INSIGHT && selectedPersona && insight && (
          <motion.div key="insight" variants={pageVariants} initial="initial" animate="animate" exit="exit"
            transition={{ duration: 0.3 }}>
            <InsightScreen
              persona={selectedPersona}
              insight={insight}
              onReset={handleReset}
              onSleepEnv={() => setScreen(SCREENS.SLEEP_ENV)}
            />
          </motion.div>
        )}

        {screen === SCREENS.SLEEP_ENV && selectedPersona && (
          <motion.div key="sleep_env" variants={pageVariants} initial="initial" animate="animate" exit="exit"
            transition={{ duration: 0.3 }}>
            <SleepEnvironmentScreen
              persona={selectedPersona}
              onBack={handleBackToDashboard}
            />
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
