
import React from 'react';
import { Box, SpaceBetween, Spinner } from '@cloudscape-design/components';
import Lottie from 'lottie-react';
import { useEffect, useState } from 'react';
import { getS3JSONFromBucket } from '../utils/S3Utils';
import ChatBox from './ChatBox';
import { Animation, EDA_ANIMATIONS_BASE_PATH, transformAnimationData } from './constants';

const loadAnimation = async (name: string): Promise<Animation | null> => {
  try {
    const path = `${EDA_ANIMATIONS_BASE_PATH}/eda_${name}.json`;
    const data = await getS3JSONFromBucket(path);
    return transformAnimationData(data);
  } catch (error) {
    console.error(`Error loading animation ${name}:`, error);
    return null;
  }
};

const animationProbabilities = [0.5, 0.2, 0.15, 0.1, 0.05];

type AnimationKey = 'fidgeting' | 'standing' | 'bored' | 'waving' | 'jumping';

const getRandomAnimation = (anims: Record<AnimationKey, Animation | undefined>): AnimationKey => {
  const animationKeys = Object.keys(anims).filter(
    (key): key is AnimationKey => anims[key as AnimationKey] !== undefined
  );
  const rand = Math.random();
  let sum = 0;
  for (let i = 0; i < animationProbabilities.length && i < animationKeys.length; i++) {
    sum += animationProbabilities[i];
    if (rand <= sum) {
      return animationKeys[i];
    }
  }
  return animationKeys[0];
};

const AnimatedAssistant = () => {
  const [animationKey, setAnimationKey] = useState<AnimationKey>('fidgeting');
  const [isStopped, setIsStopped] = useState(false);
  const [animations, setAnimations] = useState<Record<AnimationKey, Animation | undefined>>({
    fidgeting: undefined,
    standing: undefined,
    bored: undefined,
    waving: undefined,
    jumping: undefined
  });
  const [isLoading, setIsLoading] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [allAnimationsLoaded, setAllAnimationsLoaded] = useState(false);

  useEffect(() => {
    const loadInitialAnimation = async () => {
      const fidgetingAnimation = await loadAnimation('fidgeting');
      if (fidgetingAnimation) {
        setAnimations({
          fidgeting: fidgetingAnimation,
          standing: undefined,
          bored: undefined,
          waving: undefined,
          jumping: undefined
        });
        setIsLoading(false);
      }
    };
    loadInitialAnimation();
  }, []);

  useEffect(() => {
    if (!isLoading) {
      const loadRemainingAnimations = async () => {
        const remainingNames: AnimationKey[] = ['standing', 'bored', 'waving', 'jumping'];
        const newAnimations = { ...animations };

        try {
          const loadedAnimations = await Promise.all(
            remainingNames.map(name => loadAnimation(name))
          );

          remainingNames.forEach((name, index) => {
            if (loadedAnimations[index]) {
              newAnimations[name] = loadedAnimations[index]!;
            }
          });

          setAnimations(newAnimations);
          setAllAnimationsLoaded(true);
        } catch (error) {
          console.error('Error loading remaining animations:', error);
        }
      };

      loadRemainingAnimations();
    }
  }, [isLoading]);

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
        if (!allAnimationsLoaded) {
          setAnimationKey('fidgeting');
          setIsStopped(false);
          return;
        }

        const newAnimationKey = getRandomAnimation(animations);
        setAnimationKey(newAnimationKey);
        setIsStopped(false);
      };

      handleAnimationEnd();
    }
  }, [animationKey, isStopped, animations, allAnimationsLoaded]);

  useEffect(() => {
    if (!isLoading && animations[animationKey]) {
      const timer = setTimeout(() => {
        setShowChat(true);
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [isLoading, animations, animationKey]);

  // const handleAnimationChange = (key: AnimationKey) => {
  //   setAnimationKey(key);
  //   setIsStopped(false);
  // };

  if (isLoading && !animations['fidgeting']) {
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
        {animations[animationKey] && (
          <Lottie
            animationData={animations[animationKey]}
            loop={true}
          />
        )}
      </div>
      {showChat && <ChatBox />}
    </SpaceBetween>
  );
};

export default AnimatedAssistant;
