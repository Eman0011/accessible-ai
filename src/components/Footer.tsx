// src/components/Footer.js
import React from 'react';
import { useTheme } from './contexts/ThemeContext';

const Footer = () => {
  const { theme } = useTheme();

  return (
    <footer className={`footer ${theme}`}>
      <p>© 2024 Castaneda Technology Services. All rights reserved.</p>
    </footer>
  );
};

export default Footer;
