import {
  Header,
  SpaceBetween,
} from '@cloudscape-design/components';
import React, { useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ProjectContext } from '../../../contexts/ProjectContext';
import { Dataset } from '../../../types/models';
import DatasetUploader from '../../common/DatasetUploader';

const CreateDataset: React.FC = () => {
  const location = useLocation();
  const { initialDataset } = location.state || {};
  const { currentProject } = useContext(ProjectContext);
  const navigate = useNavigate();

  const handleDatasetCreated = (dataset: Dataset) => {
    console.log('New dataset created:', dataset);
    navigate('/datasets');
  };

  console.debug('Create Dataset received state:', { 
    initialDataset, 
    locationState: location.state 
  });

  return (
    <SpaceBetween size="l">
      <Header variant="h1">
        {initialDataset ? 'Create New Version' : 'Create Dataset'}
      </Header>
      {currentProject && (
        <DatasetUploader
          onDatasetCreated={handleDatasetCreated}
          projectId={currentProject.id}
          initialDataset={initialDataset}
        />
      )}
    </SpaceBetween>
  );
};

export default CreateDataset;