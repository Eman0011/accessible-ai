import { FileUploader } from '@aws-amplify/ui-react-storage';
import {
  Alert,
  Button,
  FormField,
  Header,
  Input,
  Select,
  SpaceBetween,
  TableProps,
  Textarea,
} from '@cloudscape-design/components';
import { generateClient } from "aws-amplify/api";
import Papa from 'papaparse';
import React, { useEffect, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Schema } from '../../../amplify/data/resource';
import { useUser } from '../../contexts/UserContext';
import { Dataset } from '../../types/models';
import { generateStoragePath, validateUserAccess } from '../../utils/storageUtils';
import DatasetVisualizer from './DatasetVisualizer';

const client = generateClient<Schema>();

interface DatasetUploaderProps {
  onDatasetCreated: (dataset: Dataset) => void;
  projectId: string;
}

const DatasetUploader: React.FC<DatasetUploaderProps> = ({ onDatasetCreated, projectId }) => {
  const { userInfo } = useUser();
  const [datasetName, setDatasetName] = useState('');
  const [datasetDescription, setDatasetDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [displayData, setDisplayData] = useState<any[]>([]);
  const [columns, setColumns] = useState<TableProps.ColumnDefinition<any>[]>([]);
  const [isFileSelected, setIsFileSelected] = useState(false);
  const [isCreatingDataset, setIsCreatingDataset] = useState(false);
  const [isUploadComplete, setIsUploadComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newVersion, setNewVersion] = useState<number>(1);
  const [datasetId] = useState<string>(uuidv4());
  const [estimatedRowCount, setEstimatedRowCount] = useState<number | null>(null);
  const [actualRowCount, setActualRowCount] = useState<number | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const [existingDatasets, setExistingDatasets] = useState<Dataset[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(null);
  const [isCreatingNewDataset, setIsCreatingNewDataset] = useState(false);
  const [currentVersion, setCurrentVersion] = useState<number>(0);
  const [uploadBasePath, setUploadBasePath] = useState<string>('');

  useEffect(() => { 
    if (file && !datasetName) {
      setDatasetName(file.name.replace(/\.[^/.]+$/, ""));
    }
  }, [file]);

  useEffect(() => {
    console.log('Attempting to create Web Worker');
    try {
      workerRef.current = new Worker(new URL('../../workers/rowCounter.ts', import.meta.url), {
        type: 'module'
      });
      console.log('Web Worker created successfully');

      workerRef.current.onmessage = (event) => {
        console.log('Received message from worker:', event.data);
        if (event.data.type === 'rowCount') {
          setActualRowCount(event.data.count);
        } else if (event.data.type === 'progress') {
          // Update progress here if you want to show it in the UI
          console.log(`Row counting progress: ${event.data.count} rows`);
        }
      };

      workerRef.current.onerror = (error) => {
        console.error('Error in Web Worker:', error);
      };
    } catch (error) {
      console.error('Failed to create Web Worker:', error);
    }

    return () => {
      if (workerRef.current) {
        console.log('Terminating Web Worker');
        workerRef.current.terminate();
      }
    };
  }, []); // Empty dependency array to create worker only once

  const updateTable = (data: any[]) => {
    const cols = Object.keys(data[0]).map((col) => ({
      id: col,
      header: col,
      cell: (item: any) => item[col],
    }));
    setColumns(cols);
    setDisplayData(data);
  };

  const startRowCounting = (file: File) => {
    if (workerRef.current) {
      console.log('Sending message to worker to start counting rows', { fileName: file.name, fileSize: file.size });
      workerRef.current.postMessage({ type: 'countRows', file });
    } else {
      console.error('Worker not initialized, cannot start row counting');
    }
  };

  const processFile = async ({ file }: { file: File }) => {
    console.log("processFile started", { fileName: file.name, fileSize: file.size });
    setFile(file);
    setIsFileSelected(true);
    setError(null);
    setIsUploadComplete(false);
    setEstimatedRowCount(null);
    setActualRowCount(null);

    const previewData: any[] = [];
    const previewRowCount = 5;
    let sampleSize = 0;
    let rowCount = 0;

    return new Promise<{ file: File; key: string }>((resolve, reject) => {
      Papa.parse(file, {
        preview: previewRowCount,
        header: true,
        skipEmptyLines: true,
        step: (results) => {
          rowCount++;
          previewData.push(results.data);
          sampleSize += JSON.stringify(results.data).length;

          if (rowCount === previewRowCount) {
            updateTable(previewData);
            // Calculate estimated row count based on sample size
            const avgRowSize = sampleSize / previewData.length;
            const estimatedRows = Math.round(file.size / avgRowSize);
            setEstimatedRowCount(estimatedRows);
            console.log("File processing complete", { estimatedRows, previewRowCount: previewData.length });
            // Start row counting
            startRowCounting(file);
            resolve({ file, key: `${file.name}` });
          }
        },
        error: (error) => {
          console.error('Error parsing file:', error);
          setError(`Error parsing file: ${error.message}`);
          reject(error);
        },
      });
    });
  };

  const fetchExistingDatasets = async () => {
    try {
      const { data: datasets } = await client.models.Dataset.list({
        filter: { projectId: { eq: projectId } }
      });
      setExistingDatasets(datasets as unknown as Dataset[]);
    } catch (error) {
      console.error('Error fetching datasets:', error);
      setError('Error fetching existing datasets');
    }
  };

  const createNewDataset = async () => {
    try {
      const { data: newDataset } = await client.models.Dataset.create({
        id: datasetId,
        name: datasetName,
        description: datasetDescription,
        owner: userInfo?.username || 'unknown_user',
        ownerId: userInfo?.userId || 'unknown_user',
        projectId: projectId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      console.log("New Dataset: ", newDataset)
      return newDataset;
    } catch (error) {
      console.error('Error creating dataset:', error);
      throw error;
    }
  };

  const createDatasetVersion = async (datasetId: string) => {
    if (!file || !uploadBasePath) return null;
    
    try {
      const newVersion = await getNewVersion(datasetId);
      const s3Key = `${uploadBasePath}${file.name}`;

      const { data: newDatasetVersion } = await client.models.DatasetVersion.create({
        datasetId: datasetId,
        version: newVersion,
        s3Key: s3Key,
        size: file.size,
        rowCount: actualRowCount || estimatedRowCount || 0,
        uploadDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      return newDatasetVersion;
    } catch (error) {
      console.error('Error creating dataset version:', error);
      throw error;
    }
  };

  const getNewVersion = async (datasetId: string) => {
    try {
      const { data: versions } = await client.models.DatasetVersion.list({
        filter: { datasetId: { eq: datasetId } }
      });
      let newVersion = 1;
      if (versions && versions.length > 0) {
        newVersion = Math.max(...versions.map(v => v.version)) + 1;
      }
      return newVersion;
    } catch (error) {
      console.error('Error fetching dataset versions:', error);
      throw error;
    }
  };

  const handleCreateDataset = async () => {
    if (!file || !datasetName || !projectId) {
      setError('Missing required fields for dataset creation');
      return;
    }

    setError(null);
    setIsCreatingDataset(true);
    try {
      let targetDatasetId: string;

      if (selectedDatasetId === '+ Create new dataset') {
        const newDataset = await createNewDataset();
        targetDatasetId = newDataset.id;
      } else {
        targetDatasetId = selectedDatasetId || '';
      }

      const newVersion = await createDatasetVersion(targetDatasetId);
      
      if (newVersion) {
        // Fetch the complete dataset with its new version
        const { data: updatedDataset } = await client.models.Dataset.get({ id: targetDatasetId });
        onDatasetCreated(updatedDataset as unknown as Dataset);
        resetForm();
      }
    } catch (error) {
      console.error('Error in dataset creation process:', error);
      setError('Error creating dataset. Please try again.');
    } finally {
      setIsCreatingDataset(false);
    }
  };

  const resetForm = () => {
    setDatasetName('');
    setDatasetDescription('');
    setFile(null);
    setDisplayData([]);
    setColumns([]);
    setIsFileSelected(false);
    setEstimatedRowCount(null);
    setActualRowCount(null);
    setIsUploadComplete(false);
    setSelectedDatasetId(null);
  };

  useEffect(() => {
    fetchExistingDatasets();
  }, [projectId]);

  useEffect(() => {
    if (selectedDatasetId && selectedDatasetId !== '+ Create new dataset') {
      fetchCurrentVersion(selectedDatasetId);
    }
  }, [selectedDatasetId]);

  const fetchCurrentVersion = async (datasetId: string) => {
    try {
      const { data: versions } = await client.models.DatasetVersion.list({
        filter: { datasetId: { eq: datasetId } }
      });
      if (versions && versions.length > 0) {
        const maxVersion = Math.max(...versions.map(v => v.version));
        setCurrentVersion(maxVersion);
      }
    } catch (error) {
      console.error('Error fetching dataset versions:', error);
    }
  };

  const getDatasetPreview = () => {
    if (!isFileSelected || !displayData.length) return null;

    const uploadDate = new Date().toISOString();
    const size = file?.size || 0;
    const formattedSize = size ? (size / (1024 * 1024)).toFixed(2) : '0';

    return (
      <DatasetVisualizer
        dataset={{
          name: datasetName,
          description: datasetDescription,
          owner: userInfo?.userName || 'unknown_user',
          projectId: projectId,
          id: selectedDatasetId || datasetId,
        }}
        previewData={displayData}
        columns={columns}
        version={{
          uploadDate,
          size,
          rowCount: actualRowCount || estimatedRowCount || 0,
          version: currentVersion + 1
        }}
      />
    );
  };

  useEffect(() => {
    if (userInfo?.userId && projectId && datasetId) {
      const basePath = generateStoragePath({
        userId: userInfo.userId,
        projectId,
        resourceType: 'datasets',
        resourceId: datasetId,
        version: currentVersion + 1
      });
      
      if (validateUserAccess(userInfo, userInfo.userId)) {
        setUploadBasePath(basePath + "/");
      } else {
        setError('You do not have permission to upload to this location');
      }
    }
  }, [userInfo, projectId, datasetId]);

  return (
    <SpaceBetween size="m">
      {error && <Alert type="error" header="Error">{error}</Alert>}
      
      <FormField label="Dataset">
        <Select
          selectedOption={selectedDatasetId ? 
            { label: existingDatasets.find(d => d.id === selectedDatasetId)?.name || '', 
              value: selectedDatasetId 
            } : null
          }
          onChange={({ detail }) => {
            const selectedValue = detail.selectedOption.value;
            setSelectedDatasetId(selectedValue || null);
            
            if (selectedValue === '+ Create new dataset') {
              setIsCreatingNewDataset(true);
              setDatasetName('');
              setDatasetDescription('');
            } else {
              setIsCreatingNewDataset(false);
              const dataset = existingDatasets.find(d => d.id === selectedValue);
              if (dataset) {
                setDatasetName(dataset.name);
                setDatasetDescription(dataset.description);
              }
            }
          }}
          options={[
            { label: '+ Create new dataset', value: '+ Create new dataset' },
            ...existingDatasets.map(dataset => ({
              label: dataset.name,
              value: dataset.id
            }))
          ]}
          placeholder="Choose a dataset or create new"
        />
      </FormField>

      <FormField label="Dataset Name">
        <Input
          value={datasetName}
          onChange={({ detail }) => setDatasetName(detail.value)}
          placeholder="Enter dataset name"
          disabled={!isCreatingNewDataset || isCreatingDataset}
        />
      </FormField>

      <FormField label="Description">
        <Textarea
          value={datasetDescription}
          onChange={({ detail }) => setDatasetDescription(detail.value)}
          placeholder="Enter dataset description"
          disabled={!isCreatingNewDataset || isCreatingDataset}
        />
      </FormField>

      {/* File upload section */}
      {!isCreatingDataset && (selectedDatasetId || isCreatingNewDataset) && uploadBasePath && (
        <>
          {selectedDatasetId && selectedDatasetId !== '+ Create new dataset' && (
            <Header 
              variant="h3"
              description={`Current version: ${currentVersion}`}
            >
              Upload New Dataset Version
            </Header>
          )}
          <FileUploader
            path={uploadBasePath}
            acceptedFileTypes={['.csv', '.tsv']}
            maxFileCount={1}
            processFile={processFile}
            onUploadStart={() => {
              console.log("Upload started");
            }}
            onUploadSuccess={() => {
              console.log("Upload success");
              setIsUploadComplete(true);
            }}
            onUploadError={(error) => {
              console.error('Error uploading file:', error);
              setError(`Error uploading file: ${error}`);
            }}
            onFileRemove={() => {
              console.log("File removed");
              setFile(null);
              setIsFileSelected(false);
              setDisplayData([]);
              setColumns([]);
              setError(null);
              setEstimatedRowCount(0);
              setIsUploadComplete(false);
            }}
          />
        </>
      )}

      {/* Preview section */}
      {getDatasetPreview()}

      <Button 
        onClick={handleCreateDataset} 
        variant="primary"
        loading={isCreatingDataset}
        disabled={!datasetName || !file || !isFileSelected || !isUploadComplete || isCreatingDataset}
      >
        {selectedDatasetId && selectedDatasetId !== '+ Create new dataset' 
          ? 'Create New Version' 
          : 'Create Dataset'
        }
      </Button>
    </SpaceBetween>
  );
};

export default DatasetUploader;
