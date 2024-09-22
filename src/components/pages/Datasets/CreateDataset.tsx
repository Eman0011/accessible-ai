import {
  Header,
  SpaceBetween,
} from '@cloudscape-design/components';
import React, { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProjectContext } from '../../../contexts/ProjectContext';
import { Dataset } from '../../../types/models';
import DatasetUploader from '../../common/DatasetUploader';

const CreateDataset: React.FC = () => {
  const { currentProject } = useContext(ProjectContext);
  const navigate = useNavigate();

  const handleDatasetCreated = (dataset: Dataset) => {
    console.log('New dataset created:', dataset);
    navigate('/datasets');
  };

  return (
    <SpaceBetween size="l">
      <Header variant="h1">Create New Dataset for Project: {currentProject?.name || 'Loading...'}</Header>
      {currentProject && (
        <DatasetUploader
          onDatasetCreated={handleDatasetCreated}
          projectId={currentProject.id}
        />
      )}
    </SpaceBetween>
  );
};

export default CreateDataset;