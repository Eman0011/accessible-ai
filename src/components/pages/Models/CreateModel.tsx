import { generateClient } from "aws-amplify/api";
import { downloadData } from 'aws-amplify/storage';
import Papa from 'papaparse';
import React, { useContext, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { Schema } from "../../../../amplify/data/resource";
import amplify_config from '../../../../amplify_outputs.json';
import { TRAINING_OUTPUT_BUCKET } from '../../../../Config';
import { ProjectContext } from '../../../contexts/ProjectContext';
import { useUser } from '../../../contexts/UserContext';
import { Dataset, DatasetVersion, Model, TrainingJobResult } from '../../../types/models';
import { getCSVFromCache, setCSVInCache } from '../../../utils/CacheUtils';
import { generateStoragePath } from '../../../utils/storageUtils';
import DatasetUploader from '../../common/DatasetUploader';
import DatasetVisualizer from '../../common/DatasetVisualizer';

import {
  Button,
  Container,
  FormField,
  Header,
  Input,
  Modal,
  Select,
  SpaceBetween,
  Spinner
} from '@cloudscape-design/components';

import styles from './CreateModel.module.css';

const client = generateClient<Schema>();

const CreateModel: React.FC = () => {
  const { currentProject } = useContext(ProjectContext);
  const { userInfo: userInfo, isLoading: isUserLoading } = useUser();
  const navigate = useNavigate();
  const location = useLocation();

  const [modelName, setModelName] = useState('');
  const [existingModels, setExistingModels] = useState<Model[]>([]); 
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [selectedVersion, setSelectedVersion] = useState(1)
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [uniqueDatasetNames, setUniqueDatasetNames] = useState<string[]>([]);
  const [selectedDatasetName, setSelectedDatasetName] = useState<string | null>(null);
  const [selectedDatasetVersion, setSelectedDatasetVersion] = useState<number | null>(null);
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null);
  const [selectedColumn, setSelectedColumn] = useState<string | null>(null);
  const [isCreatingNewDataset, setIsCreatingNewDataset] = useState(false);
  const [isModelCreationSubmitted, setIsModelCreationSubmitted] = useState(false);
  const [columns, setColumns] = useState<string[]>([]);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isCreatingNewModel, setIsCreatingNewModel] = useState(false); 
  const [newModelName, setNewModelName] = useState(''); 
  const [newModelDescription, setNewModelDescription] = useState('');
  const [datasetVersions, setDatasetVersions] = useState<DatasetVersion[]>([]);
  const [selectedDatasetVersions, setSelectedDatasetVersions] = useState<DatasetVersion[]>([]);
  const [error, setError] = useState<string | null>(null);

  const initialDataset = location.state?.initialDataset;

  useEffect(() => {
    console.log('Initial useEffect - currentProject:', currentProject?.id);
    if (currentProject) {
      console.log('Fetching initial data for project:', currentProject.id);
      fetchDatasets();
      fetchExistingModels();
    }
  }, [currentProject]);

  useEffect(() => {
    console.log('Models useEffect - existingModels:', existingModels);
    if (existingModels.length > 0) {
      const passedModelId = (location.state as { selectedModelId?: string })?.selectedModelId;
      console.log('Passed model ID:', passedModelId);
      if (passedModelId) {
        setSelectedModelId(passedModelId);
        const selectedModel = existingModels.find(m => m.id === passedModelId);
        console.log('Found selected model:', selectedModel);
        if (selectedModel) {
          setModelName(selectedModel.name);
        }
      }
    }
  }, [existingModels, location.state]);

  useEffect(() => {
    console.log('Location state:', location.state);
    console.log('Initial dataset:', initialDataset);
    
    if (initialDataset) {
        // Set the initial dataset
        setSelectedDataset({
            id: initialDataset.datasetId,
            name: initialDataset.datasetName,
            description: '',  // Add required fields
            owner: '',
            projectId: currentProject?.id || '',
            createdAt: null,
            updatedAt: null
        });
        
        // Set version information
        setSelectedDatasetName(initialDataset.datasetName);
        setSelectedDatasetVersion(initialDataset.version);
        
        // Fetch dataset versions for the selected dataset
        if (initialDataset.datasetId) {
            fetchDatasetVersions(initialDataset.datasetId);
        }
    }
}, [location.state, currentProject]);

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

  const fetchExistingModels = async () => {
    try {
      console.log('Fetching existing models for project:', currentProject?.id);
      const { data: models } = await client.models.Model.list({
        filter: { projectId: { eq: currentProject?.id } }
      });
      
      console.log('Raw models data:', models);
      
      if (models) {
        // Map the raw data to Model type with explicit type checking
        const typedModels = models.map(model => {
          const typedModel: Model = {
            id: model.id || '',
            name: model.name || '',
            description: model.description || '',
            owner: model.owner || '',
            projectId: model.projectId || '',
            createdAt: model.createdAt || null,
            updatedAt: model.updatedAt || null
          };
          return typedModel;
        });
        
        console.log('Processed models:', typedModels);
        setExistingModels(typedModels);
      } else {
        console.log('No models returned from API');
        setExistingModels([]);
      }
    } catch (error) {
      console.error('Error fetching existing models:', error);
      setExistingModels([]);
    }
  };

  const fetchDatasetVersions = async (datasetId: string) => {
    try {
      const { data: versions } = await client.models.DatasetVersion.list({
        filter: { datasetId: { eq: datasetId } }
      });
      if (versions) {
        const typedVersions = versions.map(v => ({
          id: v.id || '',
          datasetId: v.datasetId || '',
          version: v.version || 1,
          s3Key: v.s3Key || '',
          size: v.size || 0,
          rowCount: v.rowCount || 0,
          uploadDate: v.uploadDate || '',
          createdAt: v.createdAt || null,
          updatedAt: v.updatedAt || null
        })) as DatasetVersion[];

        const sortedVersions = typedVersions.sort((a, b) => b.version - a.version);
        setSelectedDatasetVersions(sortedVersions);
        
        if (sortedVersions.length > 0) {
          setSelectedDatasetVersion(sortedVersions[0].version);
          await fetchDatasetVersionPreview(sortedVersions[0]);
        }
      }
    } catch (error) {
      console.error('Error fetching dataset versions:', error);
    }
  };

  const handleDatasetNameChange = async (name: string) => {
    if (name === '+ Create new dataset') {
      setIsCreatingNewDataset(true);
      return;
    }
    
    setSelectedDatasetName(name);
    setSelectedDatasetVersion(null);
    setSelectedColumn(null);
    setColumns([]);
    setPreviewData([]);
    
    const dataset = datasets.find(d => d.name === name);
    if (dataset) {
      setSelectedDataset(dataset);
      await fetchDatasetVersions(dataset.id);
    }
  };

  const handleDatasetVersionChange = async (version: number) => {
    setSelectedDatasetVersion(version);
    setSelectedColumn(null);
    
    const selectedVersion = selectedDatasetVersions.find(v => v.version === version);
    if (selectedVersion) {
      await fetchDatasetVersionPreview(selectedVersion);
    }
  };

  const fetchDatasetVersionPreview = async (version: DatasetVersion) => {
    setIsLoadingPreview(true);
    try {
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
            setColumns(results.meta.fields);
            setPreviewData(results.data);
          }
        },
        error: (error: Error) => {
          console.error('Error parsing CSV:', error);
        }
      });
    } catch (error) {
      console.error('Error fetching dataset preview:', error);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const fetchDatasetColumns = async (dataset: Dataset) => {
    setIsLoadingPreview(true);
    try {
        console.debug("Fetching dataset columns for dataset:", dataset);
        
        if (!dataset.s3Key) {
            throw new Error("Dataset s3Path is undefined");
            return;
        }

        // Try to get from cache first
        const cachedData = await getCSVFromCache(dataset.s3Key, { preview: true });
        if (cachedData) {
            setColumns(cachedData.meta.fields || []);
            setPreviewData(cachedData.data);
            setIsLoadingPreview(false);
            return;
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

        Papa.parse(fileContent, {
            header: true,
            preview: 20,
            complete: (results) => {
                if (results.meta && results.meta.fields) {
                    setColumns(results.meta.fields);
                    setPreviewData(results.data);

                    // Only cache if we have a valid s3Key
                    if (dataset.s3Key) {
                        setCSVInCache(dataset.s3Key, {
                            data: results.data,
                            meta: results.meta,
                            preview: true
                        }, { preview: true });
                    }
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
    setSelectedDataset(dataset);
    setIsCreatingNewDataset(false);
    fetchDatasetColumns(dataset);
  };

  async function createNewModelVersion(modelId: string) {
    if (!userInfo?.username || !userInfo?.userId) {
      throw new Error("User information not loaded");
    }

    try {
      const dataset = datasets.find(d => d.name === selectedDatasetName);
      const datasetVersion = selectedDatasetVersions.find(v => 
        v.datasetId === dataset?.id && 
        v.version === selectedDatasetVersion
      );

      if (!datasetVersion) {
        throw new Error("Selected dataset version not found");
      }

      const { data: modelVersions } = await client.models.ModelVersion.list({
        filter: { modelId: { eq: modelId } },
      });
      
      const newVersion = modelVersions.length > 0 
        ? Math.max(...modelVersions.map(v => v.version)) + 1 
        : 1;

      const s3OutputPathKey = generateStoragePath({
        userId: userInfo.userId,
        projectId: currentProject?.id || '',
        modelId: modelId,
        version: newVersion
      });

      const fileUrl = `s3://${amplify_config.storage.bucket_name}/${datasetVersion.s3Key}`;

      const { data: newModelVersion } = await client.models.ModelVersion.create({
        modelId: modelId,
        version: newVersion,
        status: 'DRAFT',
        targetFeature: selectedColumn || '',
        fileUrl: fileUrl,
        s3OutputPath: `${TRAINING_OUTPUT_BUCKET}/${s3OutputPathKey}`,
        datasetVersionId: datasetVersion.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      return newModelVersion;
    } catch (error) {
      console.error('Error creating model version:', error);
      throw error;
    }
  }

  async function createModel() {
    try {
      const { data: newModel } = await client.models.Model.create({
        name: modelName,
        description: newModelDescription,
        owner: userInfo?.username || 'unknown_user',
        projectId: currentProject?.id || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      return newModel;
    } catch (error) {
      console.error('Error creating new model:', error);
      throw error;
    }
  }

  const handleModelCreation = async () => {
    if (!currentProject || !modelName || !selectedDataset || !selectedColumn) {
      console.error('Missing required fields for model creation');
      return;
    }

    if (!userInfo?.username || !userInfo?.userId) {
      console.error('User information not loaded');
      return;
    }

    const datasetVersion = selectedDatasetVersions.find(v => 
      v.datasetId === selectedDataset.id && 
      v.version === selectedDatasetVersion
    );

    if (!datasetVersion) {
      console.error('Selected dataset version not found', {
        selectedDataset,
        selectedDatasetVersion,
        availableVersions: selectedDatasetVersions
      });
      return;
    }

    try {
      setIsModelCreationSubmitted(true);

      let modelId: string;

      if (selectedModelId && selectedModelId !== '+ Create new model') {
        modelId = selectedModelId;
      } else {
        const newModel = await createModel();
        if (!newModel?.id) {
          throw new Error('Failed to create new model');
        }
        modelId = newModel.id;
      }
      
      const newModelVersion = await createNewModelVersion(modelId);

      if (newModelVersion?.id) {
        try {
          console.log('Submitting training job for user:', userInfo.username);
          const { data: result } = await client.queries.runTrainingJob({
            submittedBy: userInfo.username,
            fileUrl: newModelVersion.fileUrl,
            targetFeature: selectedColumn,
            basePath: newModelVersion.s3OutputPath,
            modelVersionId: newModelVersion.id,
          });

          if (result) {
            const trainingJobResult = JSON.parse(result as string) as TrainingJobResult;
            await client.models.ModelVersion.update({
              id: newModelVersion.id,
              trainingJobId: trainingJobResult.jobId,
              status: 'SUBMITTED',
            });
          }

          navigate(`/models/${modelId}`);
        } catch (trainingError) {
          console.error('Error submitting training job:', trainingError);
          await client.models.ModelVersion.update({
            id: newModelVersion.id,
            status: 'TRAINING_FAILED',
          });
          throw trainingError;
        }
      }
    } catch (error) {
      console.error('Error in model creation:', error);
      setError('Failed to create model. Please try again.');
    } finally {
      setIsModelCreationSubmitted(false);
    }
  };

  const handleModelCreated = (model: Model) => {
    setExistingModels([...existingModels, model]);
    setSelectedModelId(model.id);
    setIsCreatingNewModel(false);
  };

  const createNewModel = async () => {
    if (!userInfo?.username) {
      console.error('User information not loaded');
      return;
    }

    try {
      const { data: newModel, errors } = await client.models.Model.create({
        name: newModelName,
        description: newModelDescription,
        owner: userInfo.username,
        projectId: currentProject?.id || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      if (newModel) {
        const typedModel: Model = {
          id: newModel.id || '',
          name: newModel.name || '',
          description: newModel.description || '',
          owner: newModel.owner || '',
          projectId: newModel.projectId || '',
          createdAt: newModel.createdAt || null,
          updatedAt: newModel.updatedAt || null
        };
        
        handleModelCreated(typedModel);
        setModelName(typedModel.name);
      }
    } catch (error) {
      console.error('Error creating new model:', error);
    }
  };

  return (
    <SpaceBetween size="l">
        <Header variant="h1">Create New Model</Header>
        
        <Container
            header={<Header variant="h2">Model Configuration</Header>}
        >
            <SpaceBetween size="l">
                <FormField label="Select Existing Model">
                    <Select
                        selectedOption={
                            selectedModelId === null && modelName ? 
                                { label: '+ Create new model', value: '+ Create new model' } :
                            selectedModelId ? {
                                label: existingModels.find(m => m.id === selectedModelId)?.name || '',
                                value: selectedModelId
                            } : null
                        }
                        onChange={({ detail }) => {
                            console.log('Model selection changed:', detail.selectedOption);
                            const newValue = detail.selectedOption.value || null;
                            
                            if (newValue === '+ Create new model') {
                                setIsCreatingNewModel(true);
                                setSelectedModelId(null);  // Clear selected model ID
                                setModelName('');  // Clear model name
                            } else {
                                setSelectedModelId(newValue);
                                const selectedModel = existingModels.find(m => m.id === newValue);
                                if (selectedModel) {
                                    setModelName(selectedModel.name);
                                }
                            }
                        }}
                        options={[
                            { label: '+ Create new model', value: '+ Create new model' },
                            ...existingModels.map(model => ({
                                label: model.name || 'Unnamed Model',
                                value: model.id
                            }))
                        ]}
                        placeholder="+ Create new model"
                    />
                </FormField>

                {(!selectedModelId || selectedModelId === '+ Create new model') && (
                    <SpaceBetween size="m">
                        <FormField label="Model Name">
                            <Input
                                value={modelName}
                                onChange={({ detail }) => setModelName(detail.value)}
                                placeholder="Enter model name"
                                disabled={isModelCreationSubmitted}
                            />
                        </FormField>
                        
                        <FormField label="Model Description">
                            <Input
                                value={newModelDescription}
                                onChange={({ detail }) => setNewModelDescription(detail.value)}
                                placeholder="Enter model description"
                                disabled={isModelCreationSubmitted}
                            />
                        </FormField>
                    </SpaceBetween>
                )}

                <div className={styles.divider} />

                <FormField label="Select Dataset">
                    <Select
                        placeholder="Choose a dataset"
                        options={[
                            { label: '+ Create new dataset', value: '+ Create new dataset' },
                            ...uniqueDatasetNames.map(name => ({ label: name, value: name }))
                        ]}
                        selectedOption={selectedDatasetName ? { label: selectedDatasetName, value: selectedDatasetName } : null}
                        onChange={({ detail }) => handleDatasetNameChange(detail.selectedOption.value || '')}
                        disabled={isModelCreationSubmitted}
                    />
                </FormField>

                {selectedDatasetName && (
                    <FormField label="Select Dataset Version">
                        <Select
                            placeholder="Choose a version"
                            options={selectedDatasetVersions
                                .map(version => ({
                                    label: `Version ${version.version}`,
                                    value: version.version.toString()
                                }))
                            }
                            selectedOption={selectedDatasetVersion ? 
                                { 
                                    label: `Version ${selectedDatasetVersion}`, 
                                    value: selectedDatasetVersion.toString() 
                                } : null
                            }
                            onChange={({ detail }) => handleDatasetVersionChange(parseInt(detail.selectedOption.value || '0'))}
                            disabled={isModelCreationSubmitted}
                        />
                    </FormField>
                )}

                {selectedDataset && (
                    <div className={styles['preview-container']}>
                        {isLoadingPreview ? (
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
                                version={datasetVersions.find(v => 
                                    v.datasetId === selectedDataset.id && 
                                    v.version === selectedDatasetVersion
                                )}
                                highlightedColumn={selectedColumn || undefined}
                            />
                        )}
                    </div>
                )}

                {selectedDataset && columns.length > 0 && (
                    <FormField label="Target Column">
                        <Select
                            placeholder="Select target column"
                            options={columns.map(col => ({ label: col, value: col }))}
                            selectedOption={selectedColumn ? { label: selectedColumn, value: selectedColumn } : null}
                            onChange={({ detail }) => setSelectedColumn(detail.selectedOption.value || null)}
                            disabled={isModelCreationSubmitted}
                        />
                    </FormField>
                )}

                <Button
                    variant="primary"
                    onClick={handleModelCreation}
                    disabled={
                        !selectedDataset || 
                        !selectedColumn || 
                        (!selectedModelId && !modelName) || 
                        isModelCreationSubmitted ||
                        isUserLoading
                    }
                    loading={isModelCreationSubmitted}
                >
                    Create Model and Start Training
                </Button>
            </SpaceBetween>
        </Container>

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
