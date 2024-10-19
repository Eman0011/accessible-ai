import { FileUploader } from '@aws-amplify/ui-react-storage';
import {
  Alert,
  Button,
  FormField,
  Input,
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
import DatasetVisualizer from './DatasetVisualizer';

const client = generateClient<Schema>();

interface DatasetUploaderProps {
  onDatasetCreated: (dataset: Dataset) => void;
  projectId: string;
}

const DatasetUploader: React.FC<DatasetUploaderProps> = ({ onDatasetCreated, projectId }) => {
  const { user } = useUser();
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

  useEffect(() => { 
    if (file) {
      setDatasetName(file.name.replace(/\.[^/.]+$/, "")); // Set default dataset name to file name without extension
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

  const getNewVersion = async () => {
    const existingDatasets = await client.models.Dataset.listDatasetByNameAndVersion({
      name: datasetName,
    });
    console.log("Existing Datasets:", existingDatasets);
    let newVersion = 1;
    if (existingDatasets.data && existingDatasets.data.length > 0) {
      newVersion = (existingDatasets.data[existingDatasets.data.length - 1] as unknown as Dataset).version + 1;
    }
    return newVersion;
  }

  const createDataset = async () => {
    if (!file || !datasetName || !projectId || !datasetId) {
      setError('Missing required fields for dataset creation');
      return;
    }

    setError(null);
    setIsCreatingDataset(true);
    try {
      const newVersion = await getNewVersion();
      setNewVersion(newVersion);
      const s3Key = `projects/${projectId}/datasets/${datasetId}/${file.name}`;

      const newDataset = await client.models.Dataset.create({
        id: datasetId,
        name: datasetName,
        description: datasetDescription,
        owner: user?.username || 'unknown_user',
        version: newVersion,
        s3Key: s3Key,
        size: file.size,
        rowCount: actualRowCount || estimatedRowCount || 0,
        projectId: projectId,
        uploadDate: new Date().toISOString(),
      });

      if (newDataset.data) {
        onDatasetCreated(newDataset.data as unknown as Dataset);
        // Reset form
        setDatasetName('');
        setDatasetDescription('');
        setFile(null);
        setDisplayData([]);
        setColumns([]);
        setIsFileSelected(false);
        setEstimatedRowCount(null);
        setActualRowCount(null);
        setIsUploadComplete(false);
      }
    } catch (error) {
      console.error('Error creating dataset:', error);
      setError('Error creating dataset. Please try again.');
    } finally {
      setIsCreatingDataset(false);
    }
  };

  // console.log("Render state", { isFileSelected, isCreatingDataset, isUploadComplete, datasetName, file: file?.name });

  return (
    <SpaceBetween size="m">
      {error && <Alert type="error" header="Error">{error}</Alert>}
      {!isCreatingDataset && (
        <FileUploader
          path={`projects/${projectId}/datasets/${datasetId}/`}
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
            setNewVersion(1);
            setDisplayData([]);
            setColumns([]);
            setError(null);
            setDatasetName('');
            setEstimatedRowCount(0);
            setIsUploadComplete(false);
          }}
        />
      )}
      {isFileSelected && (
        <SpaceBetween size="m">
          <FormField label="Dataset Name">
            <Input
              value={datasetName}
              onChange={({ detail }) => setDatasetName(detail.value)}
              placeholder="Enter dataset name"
              disabled={isCreatingDataset}
            />
          </FormField>
          <FormField label="Description">
            <Textarea
              value={datasetDescription}
              onChange={({ detail }) => setDatasetDescription(detail.value)}
              placeholder="Enter dataset description"
              disabled={isCreatingDataset}
            />
          </FormField>
          {displayData.length > 0 && (
            <DatasetVisualizer
              dataset={{
                name: datasetName,
                version: newVersion,
                rowCount: actualRowCount || estimatedRowCount || 0,
                size: file?.size || 0,
                uploadDate: new Date().toISOString(),
              }}
              previewData={displayData}
              columns={columns}
            />
          )}
          <Button 
            onClick={createDataset} 
            variant="primary"
            loading={isCreatingDataset}
            disabled={!datasetName || !file || !isFileSelected || !isUploadComplete || isCreatingDataset}
          >
            Create Dataset
          </Button>
        </SpaceBetween>
      )}
    </SpaceBetween>
  );
};

export default DatasetUploader;
