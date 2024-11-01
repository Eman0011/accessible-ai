import React, { useContext, useState, useRef, useEffect } from 'react';
import { generateClient } from 'aws-amplify/api';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Form,
  FormField,
  Header,
  Input,
  SpaceBetween,
  Table,
  TableProps,
} from '@cloudscape-design/components';
import { StorageManager } from '@aws-amplify/ui-react-storage';
import Papa from 'papaparse';
import type { Schema } from "../../../../amplify/data/resource";
import { ProjectContext } from '../../../contexts/ProjectContext';
import amplify_config from "../../../amplify_outputs.json";


const client = generateClient<Schema>();

const CreateDataset: React.FC = () => {
  const { currentProject, setCurrentProject, projects } = useContext(ProjectContext); // Ensure this line is correct
  const [datasetName, setDatasetName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [displayData, setDisplayData] = useState<any[]>([]);
  const [columns, setColumns] = useState<TableProps.ColumnDefinition<any>[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const navigate = useNavigate();
  const fileUploadRef = useRef<any>(null);

  useEffect(() => {
    if (!currentProject && projects.length > 0) {
      setCurrentProject(projects[0]);
    }
  }, [currentProject, projects, setCurrentProject]);

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
    console.log("Process File!");
    setFile(file);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        updateTable(results.data);
      },
      error: (error) => {
        console.error('Error parsing file:', error);
      },
    });
    return { file, key: `datasets/${currentProject?.id}/${Date.now()}-${file.name}` };
  };

  const createDataset = async () => {
    if (!file || !datasetName || !currentProject) return;

    setIsUploading(true);
    try {
      const fileUrl = `s3://${amplify_config.storage.bucket_name}/datasets/${currentProject.id}/${file.name}`;

      console.log('Creating dataset with:', {
        name: datasetName,
        version: 1,
        fileUrl: fileUrl,
        uploadDate: new Date().toISOString(),
        size: file.size,
        rowCount: parsedData.length,
        projectId: currentProject.id,
      });

      // Create dataset entry in the database
      const newDataset = await client.models.Dataset.create({
        name: datasetName,
        version: 1,
        fileUrl: fileUrl,
        uploadDate: new Date().toISOString(),
        size: file.size,
        rowCount: parsedData.length,
        projectId: currentProject.id,
      });

      console.log('New dataset created:', newDataset);

      if (newDataset.data) {
        navigate('/datasets');
      }
    } catch (error) {
      console.error('Error creating dataset:', error);
      // You might want to show an error message to the user here
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <SpaceBetween size="l">
      <Header variant="h1">Create New Dataset for Project: {currentProject?.name || 'Loading...'}</Header>
      <Form>
        <SpaceBetween size="m">
          <FormField label="Dataset Name">
            <Input
              value={datasetName}
              onChange={({ detail }) => setDatasetName(detail.value)}
              placeholder="Enter dataset name"
            />
          </FormField>
          {currentProject && (
            <StorageManager
              acceptedFileTypes={['.csv', '.tsv', 'text/csv', 'text/tab-separated-values']}
              accessLevel="private"
              maxFileCount={1}
              processFile={processFile}
              path={`datasets/${currentProject.id}/`}
              ref={fileUploadRef}
            />
          )}
          {parsedData.length > 0 && (
            <Table
              columnDefinitions={columns}
              items={displayData}
              header={<h2>{file?.name} (Preview)</h2>}
            />
          )}
          <Button
            variant="primary"
            onClick={createDataset}
            disabled={!datasetName || !file || !currentProject || isUploading}
          >
            {isUploading ? 'Uploading...' : 'Create Dataset'}
          </Button>
        </SpaceBetween>
      </Form>
    </SpaceBetween>
  );
};

export default CreateDataset;