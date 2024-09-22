import { FileUploader } from '@aws-amplify/ui-react-storage';
import { uploadData } from 'aws-amplify/storage';
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
import React, { useEffect, useState } from 'react';
import { useUser } from '../../contexts/UserContext';
import { Dataset } from '../../types/models';
import DatasetVisualizer from './DatasetVisualizer';
import { v4 as uuidv4 } from 'uuid';
import { Schema } from '../../../amplify/data/resource';

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
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [displayData, setDisplayData] = useState<any[]>([]);
  const [columns, setColumns] = useState<TableProps.ColumnDefinition<any>[]>([]);
  const [isFileSelected, setIsFileSelected] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newVersion, setNewVersion] = useState<number>(1);
  const [datasetId] = useState<string>(uuidv4());

  useEffect(() => {
    if (file) {
      setDatasetName(file.name.replace(/\.[^/.]+$/, "")); // Set default dataset name to file name without extension
    }
  }, [file]);

  const updateTable = (data: any) => {
    const cols = Object.keys(data[0]).map((col) => ({
      id: col,
      header: col,
      cell: (item: any) => item[col],
    }));
    setColumns(cols);
    setParsedData(data);
    setDisplayData(data.slice(0, 5)); // Display first 5 rows
  };

  const processFile = async ({ file }: { file: File }) => {
    setFile(file);
    setIsFileSelected(true);
    setError(null);

    return new Promise<{ file: File; key: string }>((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.data && results.data.length > 0) {
            updateTable(results.data);
            resolve({ file, key: `${file.name}` });
          } else {
            setError("The file appears to be empty or couldn't be parsed correctly.");
            reject(new Error("File parsing failed"));
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
    setIsUploading(true);
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
        rowCount: parsedData.length,
        projectId: projectId,
        uploadDate: new Date().toISOString(),
      });

      if (newDataset.data) {
        onDatasetCreated(newDataset.data as unknown as Dataset);
        // Reset form
        setDatasetName('');
        setDatasetDescription('');
        setFile(null);
        setParsedData([]);
        setDisplayData([]);
        setColumns([]);
        setIsFileSelected(false);
      }
    } catch (error) {
      console.error('Error creating dataset:', error);
      setError('Error creating dataset. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <SpaceBetween size="m">
      {error && <Alert type="error" header="Error">{error}</Alert>}
      <FileUploader
        path={`projects/${projectId}/datasets/${datasetId}/`}
        acceptedFileTypes={['.csv', '.tsv']}
        maxFileCount={1}
        processFile={processFile}
        onUploadError={(error) => {
          console.error('Error uploading file:', error);
          setError(`Error uploading file: ${error}`);
        }}
        onFileRemove={() => {
          setFile(null);
          setIsFileSelected(false);
          setNewVersion(1);
          setParsedData([]);
          setDisplayData([]);
          setColumns([]);
          setError(null);
          setDatasetName('');
        }}
      />
      {isFileSelected && (
        <SpaceBetween size="m">
          <FormField label="Dataset Name">
            <Input
              value={datasetName}
              onChange={({ detail }) => setDatasetName(detail.value)}
              placeholder="Enter dataset name"
            />
          </FormField>
          <FormField label="Description">
            <Textarea
              value={datasetDescription}
              onChange={({ detail }) => setDatasetDescription(detail.value)}
              placeholder="Enter dataset description"
            />
          </FormField>
          {parsedData.length > 0 && (
            <DatasetVisualizer
              dataset={{
                name: datasetName,
                version: newVersion,
                rowCount: parsedData.length,
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
            loading={isUploading}
            disabled={!datasetName || !file || !isFileSelected || isUploading}
          >
            Create Dataset
          </Button>
        </SpaceBetween>
      )}
    </SpaceBetween>
  );
};

export default DatasetUploader;