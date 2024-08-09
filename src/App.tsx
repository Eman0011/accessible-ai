import React from 'react'
import { Authenticator } from '@aws-amplify/ui-react';
import { AppLayout, SideNavigation, SideNavigationProps, SpaceBetween, TopNavigation } from '@cloudscape-design/components';
import { Route, BrowserRouter as Router, Routes } from 'react-router-dom';

import brainLogo from './assets/images/cts-brain-logo.png';
import Footer from "./components/Footer";

import "./assets/css/default.css";
import "./assets/css/styles.css";
import "./assets/plugins/bootstrap/css/bootstrap.min.css";
import "./assets/plugins/font-awesome/css/font-awesome.css";

import 'primeicons/primeicons.css';
import 'primereact/resources/primereact.min.css';
import 'primereact/resources/themes/saga-blue/theme.css'; // Choose a theme

import AnimatedAssistant from './components/common/eda/AnimatedAssistant';
import AccessibleAI from './components/pages/AccessibleAI/AccessibleAI';
import LandingPage from './components/pages/LandingPage';

import '@aws-amplify/ui-react/styles.css';


function App() {
  const navigationItems: ReadonlyArray<SideNavigationProps.Item> = [
    { type: 'link', text: 'Accessible AI', href: '/accessible-ai' }
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
          iconName: 'contact'
        },
        {
          type: 'button',
          text: 'Help',
          onClick: () => console.log('Help clicked'),
          iconName: 'status-info'
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
    <SpaceBetween size="m">
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
                <Route path="/" element={<LandingPage />} />
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
