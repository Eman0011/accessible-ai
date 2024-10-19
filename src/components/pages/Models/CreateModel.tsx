import { generateClient } from "aws-amplify/api";
import { downloadData } from 'aws-amplify/storage';
import Papa from 'papaparse';
import React, { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Schema } from "../../../../amplify/data/resource";
import { ProjectContext } from '../../../contexts/ProjectContext';
import { useUser } from '../../../contexts/UserContext';
import { Dataset, Model, TrainingJobResult } from '../../../types/models';
import DatasetUploader from '../../common/DatasetUploader';
import DatasetVisualizer from '../../common/DatasetVisualizer';
import amplify_config from "../../../../amplify_outputs.json";



import {
  Button,
  Form,
  FormField,
  Header,
  Input,
  Modal,
  Select,
  SpaceBetween,
  Spinner
} from '@cloudscape-design/components';

const client = generateClient<Schema>();

const CreateModel: React.FC = () => {
  const { currentProject } = useContext(ProjectContext);
  const { user } = useUser();
  const navigate = useNavigate();

  const [modelName, setModelName] = useState('');
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [uniqueDatasetNames, setUniqueDatasetNames] = useState<string[]>([]);
  const [selectedDatasetName, setSelectedDatasetName] = useState<string | null>(null);
  const [selectedDatasetVersion, setSelectedDatasetVersion] = useState<number | null>(null);
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null);
  const [selectedColumn, setSelectedColumn] = useState<string | null>(null);
  const [isCreatingNewDataset, setIsCreatingNewDataset] = useState(false);
  const [columns, setColumns] = useState<string[]>([]);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  useEffect(() => {
    if (currentProject) {
      fetchDatasets();
    }
  }, [currentProject]);

  const fetchDatasets = async () => {
    try {
      const result = await client.models.Dataset.list({
        filter: { projectId: { eq: currentProject?.id } }
      });
      if (result.data) {
        const fetchedDatasets = result.data as unknown as Dataset[];
        setDatasets(fetchedDatasets);
        const uniqueNames = Array.from(new Set(fetchedDatasets.map(d => d.name)));
        setUniqueDatasetNames(uniqueNames);
      }
    } catch (error) {
      console.error('Error fetching datasets:', error);
    }
  };

  const handleDatasetNameChange = async (name: string) => {
    if (name === '+ Create new dataset') {
      setIsCreatingNewDataset(true);
      return;
    }
    setSelectedDatasetName(name);
    const versionsForName = datasets
      .filter(d => d.name === name)
      .sort((a, b) => b.version - a.version);
    if (versionsForName.length > 0) {
      const latestVersion = versionsForName[0].version;
      setSelectedDatasetVersion(latestVersion);
      const selected = versionsForName[0];
      setSelectedDataset(selected);
      setSelectedColumn(null);
      if (selected) {
        await fetchDatasetColumns(selected);
      }
    } else {
      setSelectedDatasetVersion(null);
      setSelectedDataset(null);
      setSelectedColumn(null);
      setColumns([]);
      setPreviewData([]);
    }
  };

  const handleDatasetVersionChange = async (version: number) => {
    console.log("Handling dataset version change:", version);
    const selected = datasets.find(d => d.name === selectedDatasetName && d.version === version);
    console.log("Selected dataset:", selected);
    setSelectedDatasetVersion(version);
    setSelectedDataset(selected || null);
    setSelectedColumn(null);
    if (selected) {
      console.log("Fetching dataset columns for dataset:", selected);
      await fetchDatasetColumns(selected);
    }
  };

  const fetchDatasetColumns = async (dataset: Dataset) => {
    setIsLoadingPreview(true);
    try {
      console.log("Fetching dataset columns for dataset:", dataset);
      
      if (!dataset.s3Key) {
        throw new Error("Dataset s3Key is undefined");
      }

      const { body } = await downloadData({
        path: dataset.s3Key,
        options: {
          bytesRange: {
            start: 0,
            end: 102400 // 100 KB
          },
        }
      }).result;

      const fileContent = await body.text();

      // Parse the CSV content
      Papa.parse(fileContent, {
        header: true,
        preview: 20,
        complete: (results) => {
          if (results.meta && results.meta.fields) {
            setColumns(results.meta.fields);
            setPreviewData(results.data);
          }
        },
        error: (error: Error) => {
          console.error('Error parsing CSV:', error);
        }
      });
    } catch (error) {
      console.error('Error fetching dataset columns:', error);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleDatasetCreated = (dataset: Dataset) => {
    setDatasets([...datasets, dataset]);
    setUniqueDatasetNames(Array.from(new Set([...uniqueDatasetNames, dataset.name])));
    setSelectedDatasetName(dataset.name);
    setSelectedDatasetVersion(dataset.version);
    setSelectedDataset(dataset);
    setIsCreatingNewDataset(false);
    fetchDatasetColumns(dataset);
  };

  const handleModelCreation = async () => {
    if (!currentProject || !modelName || !selectedDataset || !selectedColumn) {
      console.error('Missing required fields for model creation');
      return;
    }

    if (!selectedDataset.s3Key || !selectedDataset.id) {
      console.error('Selected dataset is missing s3Key or id');
      return;
    }

    try {
      // Check for existing models with the same name
      const existingModels = await client.models.Model.listModelByNameAndVersion({
        name: modelName,
      });

      const latestVersion = existingModels.data && existingModels.data.length > 0
        ? (existingModels.data[0] as unknown as Model).version + 1
        : 1;

      // Create a new model entry
      const newModel = await client.models.Model.create({
        name: modelName,
        description: `Model generated from dataset: ${selectedDataset.name}`,
        owner: user?.username || 'unknown_user',
        version: latestVersion,
        status: 'DRAFT',
        targetFeature: selectedColumn,
        fileUrl: selectedDataset.s3Key,
        projectId: currentProject.id,
        datasetId: selectedDataset.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      if (newModel.data) {
        const modelId = newModel.data.id;

        try {
          const userName = user?.username || 'unknown_user'
          // Submit the training job
          const result = await client.queries.runTrainingJob({
            submittedBy: userName,
            fileUrl: `s3://${amplify_config.storage.bucket_name}/${selectedDataset.s3Key}`,
            targetFeature: selectedColumn,
            modelId: modelId,
            projectId: currentProject.id,
          });

          if (result.data) {
            const trainingJobResult = JSON.parse(result.data as string) as TrainingJobResult;
            await client.models.Model.update({
              id: modelId,
              trainingJobId: trainingJobResult.jobId,
              status: 'SUBMITTED',
            });
          }
        } catch (trainingError) {
          console.error('Error submitting training job:', trainingError);
          await client.models.Model.update({
            id: modelId,
            status: "TRAINING_FAILED",
          });
        }

        navigate(`/models/${modelId}`);
      }
    } catch (error) {
      console.error('Error creating model:', error);
    }
  };

  return (
    <SpaceBetween size="l">
      <Header variant="h1">Create New Model</Header>
      <Form>
        <SpaceBetween size="m">
          <FormField label="Model Name">
            <Input
              value={modelName}
              onChange={({ detail }) => setModelName(detail.value)}
              placeholder="Enter model name"
            />
          </FormField>
          <FormField label="Select Dataset">
            <Select
              placeholder="Choose a dataset"
              options={[
                { label: '+ Create new dataset', value: '+ Create new dataset' },
                ...uniqueDatasetNames.map(name => ({ label: name, value: name }))
              ]}
              selectedOption={selectedDatasetName ? { label: selectedDatasetName, value: selectedDatasetName } : null}
              onChange={({ detail }) => handleDatasetNameChange(detail.selectedOption.value || '')}
            />
          </FormField>
          {selectedDatasetName && (
            <FormField label="Select Dataset Version">
              <Select
                placeholder="Choose a version"
                options={datasets
                  .filter(d => d.name === selectedDatasetName)
                  .sort((a, b) => b.version - a.version)
                  .map(d => ({ label: `Version ${d.version}`, value: d.version.toString() }))}
                selectedOption={selectedDatasetVersion ? { label: `Version ${selectedDatasetVersion}`, value: selectedDatasetVersion.toString() } : null}
                onChange={({ detail }) => handleDatasetVersionChange(parseInt(detail.selectedOption.value || '0'))}
              />
            </FormField>
          )}
          {selectedDataset && (
            isLoadingPreview ? (
              <Spinner size="large" />
            ) : (
              <DatasetVisualizer
                dataset={selectedDataset}
                previewData={previewData}
                columns={columns.map(col => ({
                  id: col,
                  header: col,
                  cell: (item: any) => item[col],
                }))}
                limit={10}
                highlightedColumn={selectedColumn}  // Add this line
              />
            )
          )}
          {selectedDataset && columns.length > 0 && (
            <FormField label="Target Column">
              <Select
                placeholder="Select target column"
                options={columns.map(col => ({ label: col, value: col }))}
                selectedOption={selectedColumn ? { label: selectedColumn, value: selectedColumn } : null}
                onChange={({ detail }) => setSelectedColumn(detail.selectedOption.value || null)}
              />
            </FormField>
          )}
          <Button
            variant="primary"
            onClick={handleModelCreation}
            disabled={!modelName || !selectedDataset || !selectedColumn}
          >
            Create Model and Start Training
          </Button>
        </SpaceBetween>
      </Form>
      {isCreatingNewDataset && (
        <Modal
          onDismiss={() => setIsCreatingNewDataset(false)}
          visible={true}
          header="Create New Dataset"
        >
          {currentProject && (
            <DatasetUploader
              onDatasetCreated={handleDatasetCreated}
              projectId={currentProject.id}
            />
          )}
        </Modal>
      )}
    </SpaceBetween>
  );
};

export default CreateModel;
