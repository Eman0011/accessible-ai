import { useEffect, useState } from "react";
import type { Schema } from "../amplify/data/resource";
import { generateClient } from "aws-amplify/data";
import { Authenticator } from '@aws-amplify/ui-react'
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { SideNavigation, AppLayout, TopNavigation, Button, SpaceBetween } from '@cloudscape-design/components';

import Footer from "./components/Footer"
import brainLogo from './assets/images/cts-brain-logo.png'

import "./assets/plugins/bootstrap/css/bootstrap.min.css"
import "./assets/plugins/font-awesome/css/font-awesome.css"
import "./assets/css/styles.css"
import "./assets/css/default.css"

import 'primereact/resources/themes/saga-blue/theme.css';  // Choose a theme
import 'primereact/resources/primereact.min.css';
import 'primeicons/primeicons.css';

import LandingPage from './components/pages/LandingPage';
import AnimatedAssistant from './components/common/eda/AnimatedAssistant';
import AccessibleAI from './components/pages/AccessibleAI/AccessibleAI';

import '@aws-amplify/ui-react/styles.css'

const client = generateClient<Schema>();

function App() {
  const navigationItems = [
    { type: 'link', text: 'Accessible AI', href: '/accessible-ai', element: Link }
  ];

  const topNavigation = (
    <TopNavigation
      identity={{
        href: '/',
        title: 'Castaneda Technology Services',
        logo: {
          src: brainLogo,
          alt: 'Company Logo'
        }
      }}
      utilities={[
        {
          type: 'button',
          text: 'Contact Us',
          onClick: () => console.log('Contact Us clicked'),
          iconName: 'mail'
        },
        {
          type: 'button',
          text: 'Help',
          onClick: () => console.log('Help clicked'),
          iconName: 'information'
        }
      ]}
      i18nStrings={{
        searchIconAriaLabel: 'Search',
        overflowMenuTriggerText: 'More',
        overflowMenuTitleText: 'All',
        overflowMenuBackIconAriaLabel: 'Back',
        overflowMenuDismissIconAriaLabel: 'Close'
      }}
    />
  );

  const sideNavigation = (
    <SpaceBetween size = "m">
      <SideNavigation
        header={{ text: 'Main Menu', href: '/' }}
        items={navigationItems}
        activeHref={window.location.pathname}
      />
      <AnimatedAssistant />
    </SpaceBetween>
  );

  return (
        
    <Authenticator>
      {({ signOut, user }) => (
        <Router>
        {topNavigation}
        <AppLayout
          navigation={sideNavigation}
          content={
            <Routes>
              <Route path="/" element={<LandingPage/>} />
              <Route path="/accessible-ai" element={<AccessibleAI />} />
            </Routes>
          }
        />
        <h4>{user?.signInDetails?.loginId} Signed In</h4>
        <button onClick={signOut}>Sign out</button>
        <Footer />
      </Router>
      )}
    </Authenticator>
  );
}

export default App;
