import '@aws-amplify/ui-react/styles.css';
import './assets/css/theme.css';
import brainLogo from './assets/images/cts-brain-logo.png';
import Footer from "./components/Footer";

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import ErrorBoundary from './components/ErrorBoundary';
import CreateProjectModal from './components/common/CreateProjectModal';
import AnimatedAssistant from './components/common/eda/AnimatedAssistant';

import { Authenticator } from '@aws-amplify/ui-react';
import { Alert, AppLayout, BreadcrumbGroup, SideNavigation, SideNavigationProps, SpaceBetween, Spinner, TopNavigation } from '@cloudscape-design/components';
import { generateClient } from "aws-amplify/api";
import { AuthUser } from 'aws-amplify/auth';
import { Route, BrowserRouter as Router, Routes, useLocation, useNavigate } from 'react-router-dom';
import type { Schema } from "../amplify/data/resource";
import { ProjectContext } from './contexts/ProjectContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { UserProvider, useUser } from './contexts/UserContext';
import { Project } from './types/models';
import { createUserInfo } from './utils/userUtils';

const client = generateClient<Schema>();

interface AppContentProps {
  signOut?: () => void;
  user?: AuthUser;
}

// Lazy load components
const LandingPage = React.lazy(() => import('./components/pages/LandingPage'));
const CreateModel = React.lazy(() => import('./components/pages/Models/CreateModel'));
const ModelDetails = React.lazy(() => import('./components/pages/Models/ModelDetails'));
const ModelsHome = React.lazy(() => import('./components/pages/Models/ModelsHome'));
const CreateDataset = React.lazy(() => import('./components/pages/Datasets/CreateDataset'));
const DatasetsHome = React.lazy(() => import('./components/pages/Datasets/DatasetsHome'));
const DatasetDetails = React.lazy(() => import('./components/pages/Datasets/DatasetDetails'));
const Predictions = React.lazy(() => import('./components/pages/Models/Predictions'));

const AppContent: React.FC<AppContentProps> = ({ signOut, user }) => {
  const { setUserInfo } = useUser(); 
  const location = useLocation();
  const [navigationOpen, setNavigationOpen] = useState(true);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [hasSetInitialState, setHasSetInitialState] = useState(false);
  
  // Check if we're on the model details page
  const isModelDetailsPage = location.pathname.match(/^\/models\/[^/]+$/);

  // Effect to handle initial tools panel visibility only
  useEffect(() => {
    if (isModelDetailsPage && !hasSetInitialState) {
      setToolsOpen(true);
      setNavigationOpen(false);
      setHasSetInitialState(true);
    } else if (!isModelDetailsPage) {
      // Reset the flag when leaving model details page
      setHasSetInitialState(false);
    }
  }, [isModelDetailsPage, hasSetInitialState]);

  useEffect(() => {
    const initializeUser = async () => {
      if (user) {
        try {
          const userInfo = createUserInfo(user);
          // You might want to fetch additional user data here
          setUserInfo(userInfo);
        } catch (error) {
          console.error('Error initializing user info:', error);
        }
      }
    };

    initializeUser();
  }, [user, setUserInfo]);

  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [isCreateProjectModalVisible, setIsCreateProjectModalVisible] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [showProjectWarning, setShowProjectWarning] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { userInfo } = useUser();

  const fetchProjects = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await client.models.Project.list();
      const fetchedProjects = (result.data as unknown) as Project[];
      setProjects(fetchedProjects);
      
      if (fetchedProjects.length === 0) {
        setIsCreateProjectModalVisible(true);
        setShowProjectWarning(false);
      } else if (!currentProject) {
        setCurrentProject(fetchedProjects[0]);
        setShowProjectWarning(false);
      } else {
        setShowProjectWarning(false); // Changed this line
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
      setShowProjectWarning(true);
    } finally {
      setIsLoading(false);
    }
  }, [currentProject]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Add this effect to update warning state when currentProject changes
  useEffect(() => {
    setShowProjectWarning(!currentProject && projects.length > 0);
  }, [currentProject, projects]);

  const navigationItems: ReadonlyArray<SideNavigationProps.Item> = [
    { type: 'link', text: 'Datasets', href: '/datasets' },
    { type: 'link', text: 'Models', href: '/models' },
    { type: 'link', text: 'Predictions', href: '/models/predictions' }
  ];

  const topNavigation = (
    <TopNavigation
      identity={{
        href: '/',
        title: 'Accessible AI',
        logo: {
          src: brainLogo,
          alt: 'Accessible AI Logo'
        }
      }}
      utilities={[
        {
          type: 'menu-dropdown',
          text: currentProject ? currentProject.name : 'Select Project',
          items: [
            { id: 'create', text: 'Create New Project' },
            ...projects.map(project => ({ id: project.id, text: project.name }))
          ],
          onItemClick: ({ detail }) => {
            if (detail.id === 'create') {
              setIsCreateProjectModalVisible(true);
            } else {
              setCurrentProject(projects.find(p => p.id === detail.id) || null);
            }
          }
        },
        {
          type: 'button',
          text: theme === 'dark' ? 'Light mode' : 'Dark mode',
          onClick: toggleTheme
        },
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
        },
        {
          type: 'button',
          text: 'Sign Out',
          onClick: signOut,
          // iconName: 'exit'
        },
      ]}
    />
  );

  const sideNavigation = (
    <SpaceBetween size="m">
      <SideNavigation
        header={{ text: 'Main Menu', href: '/' }}
        items={navigationItems}
        activeHref={window.location.pathname}
        onFollow={(event) => {
          if (!event.detail.external) {
            event.preventDefault();
            navigate(event.detail.href);
          }
        }}
      />
    </SpaceBetween>
  );


  const handleCreateProject = async (projectName: string, description: string) => {
    try {
      const newProject = await client.models.Project.create({
        name: projectName,
        description: description,
        owner: user?.username || 'unknown_user',
        organizationId: userInfo?.organizationId || '',
      });
      
      if (newProject.data) {
        const createdProject = (newProject.data as unknown) as Project;
        setProjects([...projects, createdProject]);
        setCurrentProject(createdProject);
        setIsCreateProjectModalVisible(false);
        return createdProject;
      } else {
        console.error('Project creation failed:', newProject.errors);
      }
    } catch (error) {
      console.error('Error creating project:', error);
    }
    return null;
  };

  useEffect(() => {
    document.body.className = theme === 'dark' 
      ? 'dark-theme awsui-dark-mode' 
      : 'light-theme awsui-light-mode';
  }, [theme]);

  const getBreadcrumbs = (pathname: string) => {
    const paths = pathname.split('/').filter(Boolean);
    const breadcrumbs = [{ text: 'Home', href: '/' }];
    
    let currentPath = '';
    paths.forEach((path) => {
      currentPath += `/${path}`;
      const text = path.charAt(0).toUpperCase() + path.slice(1);
      breadcrumbs.push({ text, href: currentPath });
    });
    
    return breadcrumbs;
  };

  return (
    <ProjectContext.Provider value={{ currentProject, setCurrentProject, projects, setProjects }}>
      <div className="app-container">
        <div id="header">{topNavigation}</div>
        {showProjectWarning && (
          <Alert
            type="warning"
            header="No project selected"
            dismissible
            onDismiss={() => setShowProjectWarning(false)}
          >
            Please select a project from the top navigation or create a new one.
          </Alert>
        )}
        <AppLayout
          navigation={sideNavigation}
          navigationOpen={navigationOpen}
          onNavigationChange={({ detail }) => setNavigationOpen(detail.open)}
          tools={<AnimatedAssistant />}
          toolsOpen={toolsOpen}
          onToolsChange={({ detail }) => setToolsOpen(detail.open)}
          content={
            <>
              {isLoading ? (
                <h3>Loading Projects...<Spinner size="large"/></h3>
              ) : (
                <SpaceBetween size="l">
                  {showProjectWarning && (
                    <Alert
                      type="warning"
                      header="No project selected"
                    >
                      Please select a project from the top navigation or create a new one.
                    </Alert>
                  )}
                  <BreadcrumbGroup
                    items={getBreadcrumbs(window.location.pathname)}
                    ariaLabel="Breadcrumbs"
                  />
                  <Suspense fallback={<Spinner />}>
                    <Routes>
                      <Route path="/" element={<LandingPage />} />
                      <Route path="/datasets" element={<DatasetsHome />} />
                      <Route path="/datasets/create" element={<CreateDataset />} />
                      <Route path="/datasets/:id" element={<DatasetDetails />} />
                      
                      <Route path="/models" element={<ModelsHome />} />
                      <Route path="/models/create" element={<CreateModel />} />
                      <Route path="/models/:modelId" element={<ModelDetails />} />
                      <Route path="/models/predictions" element={<Predictions />} />
                    </Routes>
                  </Suspense>
                </SpaceBetween>
              )}
            </>
          }
          contentType="default"
          disableContentPaddings={false}
          toolsHide={false}
          navigationHide={false}
          headerSelector="#header"
          footerSelector="#footer"
          navigationWidth={220}
          toolsWidth={350}
          maxContentWidth={Number.MAX_VALUE}
        />
        <div id="footer">
          <Footer />
        </div>
      </div>
      {isCreateProjectModalVisible && (
        <CreateProjectModal
          visible={isCreateProjectModalVisible}
          onClose={() => setIsCreateProjectModalVisible(false)}
          onCreateProject={handleCreateProject}
        />
      )}
    </ProjectContext.Provider>
  );
};

function ErrorFallback({error}: {error: Error}) {
  return (
    <div role="alert">
      <p>Something went wrong:</p>
      <pre style={{color: 'red'}}>{error.message}</pre>
    </div>
  )
}

const App: React.FC = () => {
  return (
    <ErrorBoundary fallback={<ErrorFallback error={new Error("An error occurred")} />}>
      <ThemeProvider>
        <UserProvider>
          <Authenticator>
            {({ signOut, user }) => (
              <Router>
                <AppContent signOut={signOut} user={user} />
              </Router>
            )}
          </Authenticator>
        </UserProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
};

export default App;
