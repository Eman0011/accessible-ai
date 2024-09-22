import {
  Box,
  Button,
  Header,
  SpaceBetween,
  Table,
  TextFilter
} from '@cloudscape-design/components';
import { generateClient } from 'aws-amplify/api';
import React, { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Schema } from '../../../../amplify/data/resource';
import { ProjectContext } from '../../../contexts/ProjectContext';
import { Dataset } from '../../../types/models';

const client = generateClient<Schema>();

const DatasetsHome: React.FC = () => {
  const { currentProject } = useContext(ProjectContext);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [filteringText, setFilteringText] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (currentProject) {
      fetchDatasets();
    }
  }, [currentProject]);

  const fetchDatasets = async () => {
    if (!currentProject) return;
    setLoading(true);
    try {
      const response = await client.models.Dataset.list();
      console.log("Datasets Response:", response);
      if (response.data) {
        const datasets = response.data
          .filter((dataset: any) => {
            if (!dataset || !dataset.id) {
              console.warn('Invalid dataset:', dataset);
              return false;
            }
            return true;
          })
          .map((dataset: any) => ({
            ...dataset,
          }));
        setDatasets(datasets as Dataset[]);
      } else {
        console.warn('No data in response:', response);
      }
    } catch (error) {
      console.error('Error fetching datasets:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredDatasets = datasets.filter(dataset =>
    dataset.name.toLowerCase().includes(filteringText.toLowerCase())
  );

  const columnDefinitions = [
    { id: 'name', header: 'Name', cell: (item: Dataset) => item.name },
    { id: 'version', header: 'Version', cell: (item: Dataset) => item.version },
    { id: 'uploadDate', header: 'Upload Date', cell: (item: Dataset) => new Date(item.uploadDate).toLocaleString() },
    { id: 'size', header: 'Size', cell: (item: Dataset) => `${(item.size / 1024 / 1024).toFixed(2)} MB` },
    { id: 'rowCount', header: 'Row Count', cell: (item: Dataset) => item.rowCount },
  ];

  return (
    <Box padding="l">
      <SpaceBetween size="l">
        <Header
          variant="h1"
          actions={
            <Button variant="primary" onClick={() => navigate('/datasets/create')}>
              Create New Dataset
            </Button>
          }
        >
          Datasets {currentProject ? `for ${currentProject.name}` : ''}
        </Header>
        <Table
          loading={loading}
          loadingText="Loading datasets..."
          items={filteredDatasets}
          columnDefinitions={columnDefinitions}
          header={
            <Header
              variant="h2"
              counter={`(${filteredDatasets.length})`}
              actions={
                <TextFilter
                  filteringText={filteringText}
                  filteringPlaceholder="Find datasets"
                  filteringAriaLabel="Filter datasets"
                  onChange={({ detail }) => setFilteringText(detail.filteringText)}
                />
              }
            >
              Your Datasets
            </Header>
          }
          empty={
            <Box textAlign="center" color="inherit">
              <b>No datasets</b>
              <Box padding={{ bottom: 's' }} variant="p" color="inherit">
                You don't have any datasets yet.
              </Box>
            </Box>
          }
        />
      </SpaceBetween>
    </Box>
  );
};

export default DatasetsHome;