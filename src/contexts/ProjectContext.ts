import React from 'react';
import { Project } from '../types/models';

interface ProjectContextType {
  currentProject: Project | null;
  setCurrentProject: (project: Project | null) => void;
  projects: Project[];
  setProjects: (projects: Project[]) => void;
}

export const ProjectContext = React.createContext<ProjectContextType>({
  currentProject: null,
  setCurrentProject: () => {},
  projects: [],
  setProjects: () => {},
});