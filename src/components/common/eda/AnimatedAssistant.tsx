
import { Box, SpaceBetween, Spinner } from '@cloudscape-design/components';
import Lottie from 'lottie-react';
import { useEffect, useState } from 'react';
import ChatBox from './ChatBox';

import { Animation, transformAnimationData } from './constants';

const loadAnimation = async (name: string) => {
  const module = await import(`../../../assets/animations/eda_${name}.json`);
  return transformAnimationData(module.default);
};

const animationProbabilities = [0.5, 0.2, 0.15, 0.1, 0.05];

const getRandomAnimation = (animations: Record<string, Animation>) => {
  const animationKeys = Object.keys(animations);
  const rand = Math.random();
  let sum = 0;
  for (let i = 0; i < animationProbabilities.length; i++) {
    sum += animationProbabilities[i];
    if (rand <= sum) {
      return animationKeys[i];
    }
  }
  return animationKeys[0];
};

const AnimatedAssistant = () => {
  const [animationKey, setAnimationKey] = useState('waving');
  const [isStopped, setIsStopped] = useState(false);
  const [animations, setAnimations] = useState<Record<string, Animation>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [showChat, setShowChat] = useState(false);

  useEffect(() => {
    const loadAnimations = async () => {
      const animationNames = ['standing', 'fidgeting', 'bored', 'waving', 'jumping'];
      const loadedAnimations: Record<string, Animation> = {};
      
      for (const name of animationNames) {
        loadedAnimations[name] = await loadAnimation(name);
      }
      
      setAnimations(loadedAnimations);
      setIsLoading(false);
    };
    
    loadAnimations();
  }, []);

  useEffect(() => {
    if (!animations[animationKey]) return;

    let animationDuration;
    if (animationKey === "standing") {
      animationDuration = 5000;
    } else {
      animationDuration = (animations[animationKey].op - animations[animationKey].ip) / animations[animationKey].fr * 1000;
    }

    if (!isStopped) {
      const timeoutId = setTimeout(() => {
        setIsStopped(true);
      }, animationDuration);

      return () => clearTimeout(timeoutId);
    } else {
      const handleAnimationEnd = () => {
        const availableAnimations = Object.keys(animations).length > 0 ? animations : null;
        if (!availableAnimations) return;

        const newAnimationKey = getRandomAnimation(availableAnimations);
        setAnimationKey(newAnimationKey);
        setIsStopped(false);
      };

      handleAnimationEnd();
    }
  }, [animationKey, isStopped, animations]);

  useEffect(() => {
    if (!isLoading && animations[animationKey]) {
      const timer = setTimeout(() => {
        setShowChat(true);
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [isLoading, animations, animationKey]);

  const handleAnimationChange = (key: string) => {
    setAnimationKey(key);
    setIsStopped(false);
  };

  if (isLoading || !animations[animationKey]) {
    return (
      <div className="lottie-container">
        <Box textAlign="center" padding={{ top: 'l' }}>
          <SpaceBetween size="m" direction="vertical" alignItems="center">
            <Spinner size="large" variant="normal" />
            <Box variant="h3" color="text-status-info">
              Loading EDA...
            </Box>
          </SpaceBetween>
        </Box>
      </div>
    );
  }

  return (
    <SpaceBetween size='s'>
      <div className="lottie-container">
        <Lottie
          animationData={animations[animationKey]}
          loop={true}
        />
      </div>
      <div style={{ padding: '10px' }}>
      </div>
      {showChat && <ChatBox />}
    </SpaceBetween>
  );
};

export default AnimatedAssistant;
