import {
  Box,
  Button,
  Header,
  Link,
  SpaceBetween,
  Table,
  TableProps,
  TextFilter
} from '@cloudscape-design/components';
import { generateClient } from 'aws-amplify/api';
import React, { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Schema } from '../../../../amplify/data/resource';
import { ProjectContext } from '../../../contexts/ProjectContext';
import { Model, ModelVersion } from '../../../types/models';
import { Link as RouterLink } from 'react-router-dom';

const client = generateClient<Schema>();

const ModelsHome: React.FC = () => {
  const { currentProject } = useContext(ProjectContext);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [models, setModels] = useState<Model[]>([]);
  const [modelVersions, setModelVersions] = useState<{ [key: string]: ModelVersion[] }>({});
  const [filteringText, setFilteringText] = useState('');

  useEffect(() => {
    if (currentProject) {
      fetchModels();
    }
  }, [currentProject]);

  const fetchModels = async () => {
    try {
      setLoading(true);
      const { data: fetchedModels } = await client.models.Model.list({
        filter: { projectId: { eq: currentProject?.id } }
      });

      const modelsWithVersions = fetchedModels as Model[];
      const versionsMap: { [key: string]: ModelVersion[] } = {};

      // Fetch versions for each model
      await Promise.all(
        modelsWithVersions.map(async (model) => {
          const { data: versions } = await client.models.ModelVersion.list({
            filter: { modelId: { eq: model.id } }
          });
          versionsMap[model.id] = versions as ModelVersion[];
        })
      );

      setModels(modelsWithVersions);
      setModelVersions(versionsMap);
    } catch (error) {
      console.error('Error fetching models:', error);
    } finally {
      setLoading(false);
    }
  };

  const getLatestVersion = (modelId: string): ModelVersion | undefined => {
    const versions = modelVersions[modelId] || [];
    return versions.reduce((latest, current) => 
      !latest || current.version > latest.version ? current : latest
    , undefined);
  };

  const columnDefinitions: TableProps.ColumnDefinition<Model>[] = [
    {
      id: 'name',
      header: 'Name',
      cell: (item) => (
        <Link
          onFollow={(event) => {
            event.preventDefault();
            navigate(`/models/${item.id}`);
          }}
          href="#"
        >
          {item.name}
        </Link>
      ),
      sortingField: 'name'
    },
    {
      id: 'description',
      header: 'Description',
      cell: (item) => item.description
    },
    {
      id: 'version',
      header: 'Latest Version',
      cell: (item) => {
        const latestVersion = getLatestVersion(item.id);
        return latestVersion ? `v${latestVersion.version}` : 'No versions';
      }
    },
    {
      id: 'status',
      header: 'Status',
      cell: (item) => {
        const latestVersion = getLatestVersion(item.id);
        return latestVersion ? latestVersion.status : '-';
      }
    },
    {
      id: 'updatedAt',
      header: 'Last Updated',
      cell: (item) => {
        const latestVersion = getLatestVersion(item.id);
        return latestVersion 
          ? new Date(latestVersion.updatedAt || '').toLocaleDateString()
          : new Date(item.updatedAt || '').toLocaleDateString();
      }
    }
  ];

  const filteredModels = models.filter(model => 
    model.name.toLowerCase().includes(filteringText.toLowerCase()) ||
    model.description.toLowerCase().includes(filteringText.toLowerCase())
  );

  return (
    <SpaceBetween size="l">
      <Header
        variant="h1"
        actions={
          <Button variant="primary" onClick={() => navigate('/models/create')}>
            Create Model
          </Button>
        }
      >
        Models
      </Header>

      <Table
        loading={loading}
        loadingText="Loading models..."
        items={filteredModels}
        columnDefinitions={columnDefinitions}
        trackBy="id"
        variant="container"
        header={
          <Header
            counter={`(${filteredModels.length})`}
            actions={
              <TextFilter
                filteringText={filteringText}
                filteringPlaceholder="Find models"
                filteringAriaLabel="Filter models"
                onChange={({ detail }) => setFilteringText(detail.filteringText)}
              />
            }
          >
            Your Models
          </Header>
        }
        empty={
          <Box textAlign="center" color="inherit">
            <b>No models</b>
            <Box padding={{ bottom: 's' }} variant="p" color="inherit">
              No models found.
            </Box>
          </Box>
        }
      />
    </SpaceBetween>
  );
};

export default ModelsHome;
