import {
  Box,
  Button,
  Header,
  SpaceBetween,
  Table,
  TableProps,
  TextFilter,
  Link
} from '@cloudscape-design/components';
import { generateClient } from 'aws-amplify/api';
import React, { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Schema } from '../../../../amplify/data/resource';
import { ProjectContext } from '../../../contexts/ProjectContext';
import { Dataset, DatasetVersion } from '../../../types/models';
import { Link as RouterLink } from 'react-router-dom';

const client = generateClient<Schema>();

const DatasetsHome: React.FC = () => {
  const { currentProject } = useContext(ProjectContext);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [datasetVersions, setDatasetVersions] = useState<{ [key: string]: DatasetVersion[] }>({});
  const [filteringText, setFilteringText] = useState('');

  useEffect(() => {
    if (currentProject) {
      fetchDatasets();
    }
  }, [currentProject]);

  const fetchDatasets = async () => {
    try {
      setLoading(true);
      const { data: fetchedDatasets } = await client.models.Dataset.list({
        filter: { projectId: { eq: currentProject?.id } }
      });
      
      const datasetsWithVersions: Dataset[] = fetchedDatasets as Dataset[];
      const versionsMap: { [key: string]: DatasetVersion[] } = {};

      // Fetch versions for each dataset
      await Promise.all(
        datasetsWithVersions.map(async (dataset) => {
          const { data: versions } = await client.models.DatasetVersion.list({
            filter: { datasetId: { eq: dataset.id } }
          });
          versionsMap[dataset.id] = versions as DatasetVersion[];
        })
      );

      setDatasets(datasetsWithVersions);
      setDatasetVersions(versionsMap);
    } catch (error) {
      console.error('Error fetching datasets:', error);
    } finally {
      setLoading(false);
    }
  };

  const getLatestVersion = (datasetId: string): DatasetVersion | undefined => {
    const versions = datasetVersions[datasetId] || [];
    return versions.reduce((latest, current) => 
      !latest || current.version > latest.version ? current : latest
    , undefined);
  };

  const columnDefinitions: TableProps.ColumnDefinition<Dataset>[] = [
    {
      id: 'name',
      header: 'Name',
      cell: (item) => (
        <Link
          onFollow={(event) => {
            event.preventDefault();
            navigate(`/datasets/${item.id}`);
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
      id: 'size',
      header: 'Size',
      cell: (item) => {
        const latestVersion = getLatestVersion(item.id);
        return latestVersion 
          ? `${(latestVersion.size / (1024 * 1024)).toFixed(2)} MB` 
          : '-';
      }
    },
    {
      id: 'rowCount',
      header: 'Rows',
      cell: (item) => {
        const latestVersion = getLatestVersion(item.id);
        return latestVersion 
          ? latestVersion.rowCount.toLocaleString() 
          : '-';
      }
    },
    {
      id: 'uploadDate',
      header: 'Last Updated',
      cell: (item) => {
        const latestVersion = getLatestVersion(item.id);
        return latestVersion 
          ? new Date(latestVersion.uploadDate).toLocaleDateString() 
          : '-';
      }
    }
  ];

  const filteredDatasets = datasets.filter(dataset => 
    dataset.name.toLowerCase().includes(filteringText.toLowerCase()) ||
    dataset.description.toLowerCase().includes(filteringText.toLowerCase())
  );

  return (
    <SpaceBetween size="l">
      <Header
        variant="h1"
        actions={
          <Button variant="primary" onClick={() => navigate('/datasets/create')}>
            Create Dataset
          </Button>
        }
      >
        Datasets
      </Header>

      <Table
        loading={loading}
        loadingText="Loading datasets..."
        items={filteredDatasets}
        columnDefinitions={columnDefinitions}
        trackBy="id"
        variant="container"
        header={
          <Header
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
              No datasets found.
            </Box>
          </Box>
        }
      />
    </SpaceBetween>
  );
};

export default DatasetsHome;