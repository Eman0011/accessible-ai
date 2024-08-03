import React, { useState, useEffect } from 'react';
import Input from "@cloudscape-design/components/input";
import { SpaceBetween, Button } from '@cloudscape-design/components';
import Lottie from 'react-lottie';

import standingLottie from '../../../assets/animations/eda_standing.json'
import fidgetingLottie from '../../../assets/animations/eda_fidgeting.json';
import jumpingLottie from '../../../assets/animations/eda_jumping.json';
import wavingLottie from '../../../assets/animations/eda_waving.json'
import boredLottie from '../../../assets/animations/eda_bored.json'

const animations = {
  standing: standingLottie,
  fidgeting: fidgetingLottie,
  bored: boredLottie,
  waving: wavingLottie,
  jumping: jumpingLottie,
};

const animationProbabilities = [0.5, 0.2, 0.15, 0.1, 0.05];

const getRandomAnimation = (animations) => {
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
  const [userInput, setUserInput] = useState("Hi, I'm EDA!");
  const [isStopped, setIsStopped] = useState(false);

  const defaultOptions = {
    loop: false,
    autoplay: true,
    animationData: animations[animationKey],
    rendererSettings: {
      preserveAspectRatio: 'xMidYMid slice',
    },
  };

  useEffect(() => {
    console.log("Animating: " + animationKey);
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
        const newAnimationKey = getRandomAnimation(animations);
        setAnimationKey(newAnimationKey);
        setIsStopped(false);
      };

      handleAnimationEnd();
    }
  }, [animationKey, isStopped]);

  const handleAnimationChange = (key) => {
    setAnimationKey(key);
    setIsStopped(false);
  };

  return (
    <SpaceBetween size='s'>
      <div className="lottie-container">
        <Lottie 
          options={defaultOptions} 
          height={300} 
          width={280} 
          isStopped={isStopped} 
          className="lottie-animation" 
        />
      </div>
      <div style={{ padding: '10px' }}>
        {/* <Input
          onChange={({ detail }) => setUserInput(detail.value)}
          value={userInput}
        /> */}
        <h3>{userInput}</h3>
        <SpaceBetween size='xs'>
          <Button onClick={() => handleAnimationChange('standing')}>Standing</Button>
          <Button onClick={() => handleAnimationChange('fidgeting')}>Fidgeting</Button>
          <Button onClick={() => handleAnimationChange('bored')}>Bored</Button>
          <Button onClick={() => handleAnimationChange('waving')}>Waving</Button>
          <Button onClick={() => handleAnimationChange('jumping')}>Jumping</Button>
        </SpaceBetween>
      </div>
    </SpaceBetween>
  );
};

export default AnimatedAssistant;
