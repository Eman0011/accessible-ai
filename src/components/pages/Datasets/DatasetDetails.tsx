import {
  Box,
  Button,
  ColumnLayout,
  Container,
  FormField,
  Header,
  Select,
  SpaceBetween,
  Spinner,
  Tabs,
  ExpandableSection
} from '@cloudscape-design/components';
import { generateClient } from 'aws-amplify/api';
import { downloadData } from 'aws-amplify/storage';
import Papa from 'papaparse';
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { Schema } from '../../../../amplify/data/resource';
import { Dataset, DatasetVersion } from '../../../types/models';
import { getCSVFromCache, setCSVInCache } from '../../../utils/CacheUtils';
import { formatBytes } from '../../../utils/formatUtils';
import DatasetVisualizer from '../../common/DatasetVisualizer';
import styles from './DatasetDetails.module.css';

const client = generateClient<Schema>();

const DatasetSelector: React.FC<{
    datasets: Dataset[];
    selectedDataset: Dataset | null;
    onDatasetSelect: (dataset: Dataset | null) => void;
}> = ({ datasets, selectedDataset, onDatasetSelect }) => (
    <SpaceBetween size="s">
        <Header variant="h2">
            Select Dataset
        </Header>
        <FormField
            description="Choose a dataset to view details"
        >
            <Select
                selectedOption={selectedDataset ? { label: selectedDataset.name, value: selectedDataset.id } : null}
                onChange={({ detail }) => onDatasetSelect(datasets.find(dataset => dataset.id === detail.selectedOption.value) || null)}
                options={datasets.map(dataset => ({ 
                    label: dataset.name, 
                    value: dataset.id,
                    description: dataset.description 
                }))}
                placeholder="Choose a dataset"
            />
        </FormField>
    </SpaceBetween>
);

const VersionSelector: React.FC<{
    versions: DatasetVersion[];
    selectedVersion: DatasetVersion | null;
    onVersionSelect: (version: DatasetVersion | null) => void;
}> = ({ versions, selectedVersion, onVersionSelect }) => (
    <div style={{ maxWidth: '400px' }}>
        <FormField label="Select Dataset Version">
            <Select
                selectedOption={selectedVersion ? 
                    { 
                        label: `Version ${selectedVersion.version} (${new Date(selectedVersion.uploadDate).toLocaleDateString()})`, 
                        value: selectedVersion.id 
                    } : null
                }
                onChange={({ detail }) => {
                    const version = versions.find(v => v.id === detail.selectedOption.value);
                    onVersionSelect(version || null);
                }}
                options={versions.map(version => ({
                    label: `Version ${version.version} (${new Date(version.uploadDate).toLocaleDateString()})`,
                    value: version.id
                }))}
                placeholder="Choose a version"
            />
        </FormField>
    </div>
);

const DatasetDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [versions, setVersions] = useState<DatasetVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('details');
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [columns, setColumns] = useState<any[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (id) {
      fetchDatasetDetails();
    }
  }, [id]);

  const fetchDatasetDetails = async () => {
    try {
      setLoading(true);
      const { data: fetchedDataset } = await client.models.Dataset.get({ id });
      const { data: fetchedVersions } = await client.models.DatasetVersion.list({
        filter: { datasetId: { eq: id } }
      });

      const sortedVersions: DatasetVersion[] = (fetchedVersions || []).map(v => ({
        id: v.id || '',
        datasetId: v.datasetId || '',
        version: v.version || 1,
        s3Key: v.s3Key || '',
        size: v.size || 0,
        rowCount: v.rowCount || 0,
        uploadDate: v.uploadDate || new Date().toISOString(),
        createdAt: v.createdAt || null,
        updatedAt: v.updatedAt || null
      })).sort((a, b) => b.version - a.version);

      const dataset: Dataset = {
        id: fetchedDataset?.id || '',
        name: fetchedDataset?.name || '',
        description: fetchedDataset?.description || '',
        owner: fetchedDataset?.owner || '',
        projectId: fetchedDataset?.projectId || '',
        createdAt: fetchedDataset?.createdAt || null,
        updatedAt: fetchedDataset?.updatedAt || null
      };

      setDataset(dataset);
      setVersions(sortedVersions);
      
      // Select the latest version by default
      if (sortedVersions.length > 0) {
        setSelectedVersion(sortedVersions[0].id);
        await fetchVersionPreview(sortedVersions[0]);
      }
    } catch (error) {
      console.error('Error fetching dataset details:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchVersionPreview = async (version: DatasetVersion) => {
    setLoadingPreview(true);
    try {
      console.debug('Fetching version preview for', version.s3Key);
      
      // Try to get from cache first
      const cachedData = await getCSVFromCache(version.s3Key, { preview: true });
      if (cachedData) {
        setColumns(cachedData.meta.fields?.map(field => ({
          id: field,
          header: field,
          cell: (item: any) => item[field]
        })) || []);
        setPreviewData(cachedData.data);
        setLoadingPreview(false);
        return;
      }

      // If not in cache, fetch from S3
      const { body } = await downloadData({
        path: version.s3Key,
        options: {
          bytesRange: {
            start: 0,
            end: 102400 // 100 KB
          },
        }
      }).result;

      const fileContent = await body.text();

      Papa.parse(fileContent, {
        header: true,
        preview: 10,
        complete: (results) => {
          if (results.meta && results.meta.fields) {
            const columns = results.meta.fields.map(field => ({
              id: field,
              header: field,
              cell: (item: any) => item[field]
            }));
            setColumns(columns);
            setPreviewData(results.data);

            // Cache the parsed results
            setCSVInCache(version.s3Key, {
              data: results.data,
              meta: results.meta,
              preview: true
            }, { preview: true });
          }
        },
        error: (error: Error) => {
          console.error('Error parsing CSV:', error);
        }
      });
    } catch (error) {
      console.error('Error fetching version preview:', error);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleVersionSelect = async (version: DatasetVersion | null) => {
    if (version) {
        setSelectedVersion(version.id);
        await fetchVersionPreview(version);
    }
};

  const handleCreateNewVersion = () => {
    if (dataset) {
        console.debug('Navigating to create new version with dataset:', dataset);
        navigate('/datasets/create', { 
            state: { 
                initialDataset: {
                    id: dataset.id,
                    name: dataset.name,
                    description: dataset.description,
                    owner: dataset.owner,
                    projectId: dataset.projectId,
                    createdAt: dataset.createdAt,
                    updatedAt: dataset.updatedAt
                }
            } 
        });
    }
  };

  const handleCreateModel = () => {
    console.log('Creating model with:', {
        dataset,
        selectedVersion,
        versions,
        versionDetails: versions.find(v => v.id === selectedVersion),
        navigationState: { 
            initialDataset: {
                datasetId: dataset?.id,
                datasetVersionId: selectedVersion,
                datasetName: dataset?.name,
                version: versions.find(v => v.id === selectedVersion)?.version
            }
        }
    });

    if (dataset && selectedVersion) {
        navigate('/models/create', { 
            state: { 
                initialDataset: {
                    datasetId: dataset.id,
                    datasetVersionId: selectedVersion,
                    datasetName: dataset.name,
                    version: versions.find(v => v.id === selectedVersion)?.version
                }
            } 
        });
    }
  };

  if (loading) {
    return <Spinner size="large" />;
  }

  if (!dataset) {
    return <Box>Dataset not found</Box>;
  }

  return (
    <SpaceBetween size="l">
      <Header
        variant="h1"
        actions={
          <SpaceBetween direction="horizontal" size="xs">
            <Button
              onClick={handleCreateModel}
              variant="primary"
            >
              Create Model
            </Button>
            <Button
              onClick={handleCreateNewVersion}
            >
              Create New Version
            </Button>
          </SpaceBetween>
        }
      >
        {dataset.name}
      </Header>

      <div className={styles.datasetOverview}>
        <ColumnLayout columns={8}>
          <div>
            <Box variant="awsui-key-label">Owner</Box>
            <div>{dataset?.owner}</div>
          </div>
          <div>
            <Box variant="awsui-key-label">Description</Box>
            <div>{dataset?.description || '-'}</div>
          </div>
          <div>
            <Box variant="awsui-key-label">Created</Box>
            <div>{new Date(dataset?.createdAt || '').toLocaleString()}</div>
          </div>
        </ColumnLayout>
      </div>

      <Container>
        <SpaceBetween size="s">
          <Header variant="h3">Dataset Version</Header>
          <VersionSelector
            versions={versions}
            selectedVersion={versions.find(v => v.id === selectedVersion) || null}
            onVersionSelect={handleVersionSelect}
          />
          
          {selectedVersion && (
            <ExpandableSection 
              headerText="Version Details" 
              variant="default"
            >
              <div className={styles.versionDetailsCard}>
                <ColumnLayout columns={3} variant="text-grid">
                  <div>
                    <Box variant="awsui-key-label">Upload Date</Box>
                    <div>{new Date(versions.find(v => v.id === selectedVersion)?.uploadDate || '').toLocaleString()}</div>
                  </div>
                  <div>
                    <Box variant="awsui-key-label">Size</Box>
                    <div>{versions.find(v => v.id === selectedVersion)?.size || '-'} bytes</div>
                  </div>
                  <div>
                    <Box variant="awsui-key-label">Row Count</Box>
                    <div>{versions.find(v => v.id === selectedVersion)?.rowCount || '-'}</div>
                  </div>
                </ColumnLayout>
              </div>
            </ExpandableSection>
          )}
        </SpaceBetween>
      </Container>

      <Tabs
        activeTabId={activeTab}
        onChange={({ detail }) => setActiveTab(detail.activeTabId)}
        tabs={[
          {
            id: 'details',
            label: 'Details',
            content: (
              <SpaceBetween size="l">
                {loadingPreview ? (
                  <Spinner size="large" />
                ) : (
                  selectedVersion && (
                    <DatasetVisualizer
                      dataset={dataset}
                      previewData={previewData}
                      columns={columns}
                      version={versions.find(v => v.id === selectedVersion)}
                    />
                  )
                )}
              </SpaceBetween>
            )
          },
          {
            id: 'eda',
            label: 'Exploratory Analysis',
            content: (
              <Container>
                {/* EDA content will go here */}
                <p>Exploratory Data Analysis content coming soon...</p>
              </Container>
            )
          }
        ]}
      />
    </SpaceBetween>
  );
};

export default DatasetDetails; 