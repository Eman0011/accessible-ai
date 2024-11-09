import { FileUploader } from '@aws-amplify/ui-react-storage';
import { Alert, Box, Button, Container, FormField, Header, Icon, Input, Select, SpaceBetween, Spinner, StatusIndicator, Tabs, Textarea, Toggle } from '@cloudscape-design/components';
import { generateClient } from 'aws-amplify/api';
import Papa from 'papaparse';
import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import type { Schema } from '../../../../amplify/data/resource';
import { useUser } from '../../../contexts/UserContext';
import { Model, ModelVersion } from '../../../types/models';
import { generateStoragePath } from '../../../utils/storageUtils';
import DatasetVisualizer from '../../common/DatasetVisualizer';
import ModelPipelineVisualizer from '../../common/ModelPipelineVisualizer/ModelPipelineVisualizer';
import { getS3JSONFromBucket } from '../../common/utils/S3Utils';
import styles from './Predictions.module.css';

const client = generateClient<Schema>();

interface ModelSelectorProps {
    models: Model[];
    selectedModel: Model | null;
    onModelSelect: (model: Model | null) => void;
}

const ModelSelector: React.FC<ModelSelectorProps> = ({ models, selectedModel, onModelSelect }) => (
    <SpaceBetween size="s">
        <Header variant="h2">
            Select Model
        </Header>
        <FormField
            description="Choose a model to run predictions with"
        >
            <Select
                selectedOption={selectedModel ? { label: selectedModel.name, value: selectedModel.id } : null}
                onChange={({ detail }) => onModelSelect(models.find(model => model.id === detail.selectedOption.value) || null)}
                options={models.map(model => ({ 
                    label: model.name, 
                    value: model.id,
                    description: model.description 
                }))}
                placeholder="Choose a model"
            />
        </FormField>
    </SpaceBetween>
);

interface VersionSelectorProps {
    modelVersions: ModelVersion[];
    selectedVersion: ModelVersion | null;
    onVersionSelect: (version: ModelVersion | null) => void;
}

const VersionSelector: React.FC<VersionSelectorProps> = ({ modelVersions, selectedVersion, onVersionSelect }) => (
    <FormField label="Select Model Version">
        <Select
            selectedOption={selectedVersion ? 
                { 
                    label: `Version ${selectedVersion.version} (${new Date(selectedVersion.createdAt || '').toLocaleDateString()})`, 
                    value: selectedVersion.id 
                } : null
            }
            onChange={({ detail }) => {
                const version = modelVersions.find(v => v.id === detail.selectedOption.value);
                if (version) onVersionSelect(version);
            }}
            options={modelVersions.map(version => ({
                label: `Version ${version.version} (${new Date(version.createdAt || '').toLocaleDateString()})`,
                value: version.id,
                description: version.status
            }))}
        />
    </FormField>
);

interface AdhocFormProps {
    featureNames: string[];
    featureInputs: Record<string, string>;
    onFeatureInputChange: (feature: string, value: string) => void;
    disabled?: boolean;
}

const AdhocForm: React.FC<AdhocFormProps> = ({ 
    featureNames, 
    featureInputs, 
    onFeatureInputChange,
    disabled 
}) => (
    <SpaceBetween size="m">
        {featureNames.map(feature => (
            <FormField key={feature} label={feature}>
                <Input
                    value={featureInputs[feature] || ''}
                    onChange={({ detail }) => onFeatureInputChange(feature, detail.value)}
                    disabled={disabled}
                />
            </FormField>
        ))}
    </SpaceBetween>
);

interface JsonInputProps {
    jsonInput: string;
    jsonError: string | null;
    onJsonChange: (value: string) => void;
    disabled?: boolean;
}

const JsonInput: React.FC<JsonInputProps> = ({ 
    jsonInput, 
    jsonError, 
    onJsonChange,
    disabled 
}) => (
    <FormField 
        label="JSON Input"
        errorText={jsonError}
        className={styles['json-input-container']}
    >
        <Textarea
            value={jsonInput}
            onChange={({ detail }) => onJsonChange(detail.value)}
            rows={20}
            className={styles['json-input']}
            disabled={disabled}
        />
    </FormField>
);

const JsonOutput: React.FC<{ data: any; isLastStep?: boolean }> = ({ data, isLastStep = true }) => {
    // Parse the nested response
    let parsedResponse;
    try {
        const firstParse = typeof data === 'string' ? JSON.parse(data) : data;
        if (firstParse.data && typeof firstParse.data === 'string') {
            parsedResponse = JSON.parse(firstParse.data);
        } else {
            parsedResponse = firstParse;
        }
    } catch (error) {
        console.error('Error parsing response:', error);
        parsedResponse = { statusCode: 500, body: { message: 'Error parsing response' } };
    }

    const isSuccess = parsedResponse.statusCode === 200;
    const resultValue = isSuccess 
        ? (Array.isArray(parsedResponse.body) ? parsedResponse.body[0] : parsedResponse.body)
        : 'X';  // Show X for failures
    
    const errorMessage = !isSuccess ? parsedResponse.body.message : null;
    
    return (
        <SpaceBetween size="m" direction="vertical" alignItems="start">
            <div className={styles['arrow-container']}>
                <div className={styles.arrow}>
                    <Icon name="angle-right" size="big" />
                </div>
                <div className={`${styles['step-card']} ${isLastStep ? styles['last-step'] : ''}`}>
                    <div className={styles['step-title']}>
                        Predicted Value
                    </div>
                    <div className={`${styles['result-circle']} ${!isSuccess ? styles['error-circle'] : ''}`}>
                        <div className={styles['result-value']}>
                            {isSuccess ? resultValue : (
                                <Icon 
                                    name="status-negative" 
                                    size="big" 
                                    variant="error"
                                />
                            )}
                        </div>
                    </div>
                    <div className={styles['status-container']}>
                        <StatusIndicator type={isSuccess ? "success" : "error"}>
                            {isSuccess ? "Prediction completed" : "Prediction failed"}
                        </StatusIndicator>
                    </div>
                </div>
            </div>
            {!isSuccess && errorMessage && (
                <Alert
                    type="error"
                    header="Prediction Error"
                >
                    {errorMessage}
                </Alert>
            )}
        </SpaceBetween>
    );
};

const Predictions: React.FC = () => {
    const location = useLocation();
    const navigationState = location.state as { 
        selectedModelId?: string;
        selectedModelVersion?: string;
    } | undefined;

    const [models, setModels] = useState<Model[]>([]);
    const [selectedModel, setSelectedModel] = useState<Model | null>(null);
    const [modelVersions, setModelVersions] = useState<ModelVersion[]>([]);
    const [selectedModelVersion, setSelectedModelVersion] = useState<ModelVersion | null>(null);
    const [featureNames, setFeatureNames] = useState<string[]>([]);
    const [featureInputs, setFeatureInputs] = useState<Record<string, string>>({});
    const [isAdhocMode, setIsAdhocMode] = useState(true);
    const [batchFile, setBatchFile] = useState<File | null>(null);
    const [results, setResults] = useState<any>(null);
    const [filePreview, setFilePreview] = useState<string | null>(null);
    const [previewData, setPreviewData] = useState<any[]>([]);
    const [columns, setColumns] = useState<any[]>([]);
    const [jsonInput, setJsonInput] = useState<string>('');
    const [adhocInputMode, setAdhocInputMode] = useState<'form' | 'json'>('form');
    const [jsonError, setJsonError] = useState<string | null>(null);
    const [uploadBasePath, setUploadBasePath] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);
    const { userInfo } = useUser();

    useEffect(() => {
        const fetchModels = async () => {
            const response = await client.models.Model.list();
            const typedModels = response.data.map(model => ({
                id: model.id || '',
                name: model.name || '',
                description: model.description || '',
                owner: model.owner || '',
                projectId: model.projectId || '',
                createdAt: model.createdAt || null,
                updatedAt: model.updatedAt || null
            })) as Model[];
            setModels(typedModels);

            if (navigationState?.selectedModelId) {
                const preSelectedModel = typedModels.find(
                    model => model.id === navigationState.selectedModelId
                );
                if (preSelectedModel) {
                    setSelectedModel(preSelectedModel);
                }
            }
        };
        fetchModels();
    }, [navigationState?.selectedModelId]);

    useEffect(() => {
        const fetchModelVersions = async () => {
            if (selectedModel) {
                const { data: versions } = await client.models.ModelVersion.list({
                    filter: { modelId: { eq: selectedModel.id } }
                });
                
                const typedVersions = versions.map(v => ({
                    id: v.id || '',
                    modelId: v.modelId || '',
                    version: v.version || 0,
                    status: v.status || '',
                    targetFeature: v.targetFeature || '',
                    fileUrl: v.fileUrl || '',
                    s3OutputPath: v.s3OutputPath || '',
                    datasetVersionId: v.datasetVersionId || '',
                    trainingJobId: v.trainingJobId || '',
                    performanceMetrics: v.performanceMetrics || {},
                    createdAt: v.createdAt || null,
                    updatedAt: v.updatedAt || null
                })) as ModelVersion[];

                const sortedVersions = typedVersions.sort((a, b) => b.version - a.version);
                setModelVersions(sortedVersions);

                if (navigationState?.selectedModelVersion) {
                    const preSelectedVersion = sortedVersions.find(
                        version => version.id === navigationState.selectedModelVersion
                    );
                    if (preSelectedVersion) {
                        setSelectedModelVersion(preSelectedVersion);
                    }
                } else if (sortedVersions.length > 0) {
                    setSelectedModelVersion(sortedVersions[0]);
                }
            }
        };

        if (selectedModel) {
            fetchModelVersions();
        }
    }, [selectedModel, navigationState?.selectedModelVersion]);

    useEffect(() => {
        const fetchFeatureNames = async () => {
            if (selectedModelVersion) {
                try {
                    const feature_names = await getS3JSONFromBucket<string[]>(
                        `${selectedModelVersion.s3OutputPath}/feature_names.json`
                    );
                    
                    setFeatureNames(Array.isArray(feature_names) ? feature_names : []);
                    const initialInputs = feature_names.reduce<Record<string, string>>((acc, feature) => ({
                        ...acc,
                        [feature]: ''
                    }), {});
                    setFeatureInputs(initialInputs);

                    const template = feature_names.reduce((acc, feature) => ({
                        ...acc,
                        [feature]: ''
                    }), {});
                    setJsonInput(JSON.stringify(template, null, 2));
                } catch (error) {
                    console.error('Error fetching feature names:', error);
                    setFeatureNames([]);
                }
            }
        };

        if (selectedModelVersion) {
            fetchFeatureNames();
        }
    }, [selectedModelVersion]);

    useEffect(() => {
        if (selectedModelVersion && selectedModel && userInfo) {
            const timestamp = new Date().toISOString().replace(/:/g, '-');
            const basePath = generateStoragePath({
                userId: userInfo.userId,
                projectId: selectedModel.projectId,
                resourceType: 'predictions',
                resourceId: selectedModelVersion.id,
                version: selectedModelVersion.version,
                fileName: timestamp
            });
            console.log("uploadBasePath", basePath);
            setUploadBasePath(basePath);
        }
    }, [selectedModelVersion, selectedModel, userInfo]);

    const validateAndParseJSON = (jsonString: string): Record<string, string> | null => {
        try {
            const parsed = JSON.parse(jsonString);
            setJsonError(null);
            return parsed;
        } catch (error) {
            setJsonError('Invalid JSON format');
            return null;
        }
    };

    const handleAdhocInference = async () => {
        if (!selectedModelVersion || !selectedModelVersion.targetFeature || 
            !selectedModelVersion.s3OutputPath || !userInfo?.username) {
            console.error('Missing required fields');
            return;
        }
        
        setIsLoading(true);
        try {
            let inputData: Record<string, any>;
            if (adhocInputMode === 'json') {
                const parsed = validateAndParseJSON(jsonInput);
                if (!parsed) return;
                inputData = parsed;
            } else {
                inputData = Object.entries(featureInputs).reduce((acc, [key, value]) => ({
                    ...acc,
                    [key]: isNaN(Number(value)) ? value : Number(value)
                }), {});
            }

            const payload = {
                modelVersionId: selectedModelVersion.id,
                basePath: selectedModelVersion.s3OutputPath,
                targetFeature: selectedModelVersion.targetFeature,
                submittedBy: userInfo.username,
                input: JSON.stringify(inputData)
            };
            
            console.log("Inference payload:", payload);

            const response = await client.queries.runModelInference(payload);
            console.log("Inference response:", response);
            setResults(response.data);
        } catch (error) {
            console.error('Inference error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleBatchInference = async () => {
        if (!batchFile || !selectedModelVersion || !selectedModelVersion.targetFeature || 
            !selectedModelVersion.s3OutputPath || !userInfo?.username) {
            console.error('Missing required fields');
            return;
        }
        
        setIsLoading(true);
        try {
            const payload = {
                modelVersionId: selectedModelVersion.id,
                basePath: selectedModelVersion.s3OutputPath,
                targetFeature: selectedModelVersion.targetFeature,
                submittedBy: userInfo.username,
                inputDataPath: `${uploadBasePath}/${batchFile.name}`
            };
            
            console.log("Batch inference payload:", payload);

            const response = await client.queries.runModelInference(payload);
            console.log("Batch inference response:", response);
            setResults(response.data);
        } catch (error) {
            console.error('Batch inference error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const processFile = async ({ file }: { file: File }) => {
        console.log("processFile started", { fileName: file.name, fileSize: file.size });
        setBatchFile(file);

        return new Promise<{ file: File; key: string }>((resolve, reject) => {
            Papa.parse(file, {
                header: true,
                preview: 10,
                skipEmptyLines: true,
                complete: (results) => {
                    if (results.meta && results.meta.fields) {
                        setColumns(results.meta.fields.map(field => ({
                            id: field,
                            header: field,
                            cell: (item: any) => item[field]
                        })));
                        setPreviewData(results.data);
                    }
                    console.log("File processing complete", { previewRowCount: results.data.length });
                    resolve({ file, key: file.name });
                },
                error: (error) => {
                    console.error('Error parsing file:', error);
                    reject(error);
                }
            });
        });
    };

    return (
        <SpaceBetween size="l">
            <Header variant="h1">Run Model Predictions</Header>
            
            <div style={{ display: 'flex', width: '100%', gap: '24px' }}>
                <div style={{ 
                    width: '300px',
                    minWidth: '300px',
                    flexShrink: 0
                }}>
                    <SpaceBetween size="m">
                        <Container>
                            <ModelSelector 
                                models={models}
                                selectedModel={selectedModel}
                                onModelSelect={setSelectedModel}
                            />
                            
                            {selectedModel && (
                                <VersionSelector
                                    modelVersions={modelVersions}
                                    selectedVersion={selectedModelVersion}
                                    onVersionSelect={setSelectedModelVersion}
                                />
                            )}
                        </Container>

                        {selectedModelVersion && (
                            <Container
                                header={<Header variant="h2">Prediction Input</Header>}
                            >
                                <SpaceBetween size="m">
                                    <div>
                                        <Box variant="awsui-key-label">Prediction Type</Box>
                                        <div style={{ 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            gap: '1rem',
                                            marginTop: '8px'
                                        }}>
                                            <Box color={isAdhocMode ? 'text-label' : 'text-body-secondary'}>
                                                Ad-hoc
                                            </Box>
                                            <Toggle
                                                onChange={({ detail }) => setIsAdhocMode(!detail.checked)}
                                                checked={!isAdhocMode}
                                                disabled={isLoading}
                                            />
                                            <Box color={!isAdhocMode ? 'text-label' : 'text-body-secondary'}>
                                                Batch
                                            </Box>
                                        </div>
                                    </div>

                                    {isAdhocMode ? (
                                        <SpaceBetween size="m">
                                            <Tabs
                                                tabs={[
                                                    {
                                                        label: "Form Input",
                                                        id: "form",
                                                        content: (
                                                            <AdhocForm
                                                                featureNames={featureNames}
                                                                featureInputs={featureInputs}
                                                                onFeatureInputChange={(feature, value) => 
                                                                    setFeatureInputs(prev => ({
                                                                        ...prev,
                                                                        [feature]: value
                                                                    }))
                                                                }
                                                                disabled={isLoading}
                                                            />
                                                        )
                                                    },
                                                    {
                                                        label: "JSON Input",
                                                        id: "json",
                                                        content: (
                                                            <JsonInput
                                                                jsonInput={jsonInput}
                                                                jsonError={jsonError}
                                                                onJsonChange={(value) => {
                                                                    setJsonInput(value);
                                                                    validateAndParseJSON(value);
                                                                }}
                                                                disabled={isLoading}
                                                            />
                                                        )
                                                    }
                                                ]}
                                                onChange={({ detail }) => 
                                                    setAdhocInputMode(detail.activeTabId as 'form' | 'json')
                                                }
                                            />

                                            <Button 
                                                onClick={handleAdhocInference} 
                                                disabled={!selectedModelVersion || 
                                                     (adhocInputMode === 'json' && !!jsonError) || 
                                                     isLoading}
                                                loading={isLoading}
                                            >
                                                Run Ad-hoc Prediction
                                            </Button>
                                        </SpaceBetween>
                                    ) : (
                                        <SpaceBetween size="m">
                                            <FormField 
                                                label="Upload Batch File"
                                                description="Upload a CSV file containing the data for batch predictions."
                                            >
                                                <Box margin={{ bottom: 's' }}>
                                                    <FileUploader
                                                        path={uploadBasePath}
                                                        acceptedFileTypes={['.csv']}
                                                        maxFileCount={1}
                                                        processFile={processFile}
                                                        accessLevel="private"
                                                    />
                                                </Box>
                                            </FormField>
                                            
                                            {batchFile && previewData.length > 0 && (
                                                <DatasetVisualizer
                                                    dataset={{
                                                        id: 'preview',
                                                        name: batchFile.name,
                                                        description: 'Batch inference preview',
                                                        owner: '',
                                                        projectId: '',
                                                    }}
                                                    previewData={previewData}
                                                    columns={columns}
                                                    version={{
                                                        uploadDate: new Date().toISOString(),
                                                        size: batchFile.size,
                                                        rowCount: previewData.length,
                                                        version: 1
                                                    }}
                                                />
                                            )}

                                            <Button 
                                                onClick={handleBatchInference} 
                                                disabled={!selectedModelVersion || !batchFile || isLoading}
                                                loading={isLoading}
                                            >
                                                Run Batch Inference
                                            </Button>
                                        </SpaceBetween>
                                    )}
                                </SpaceBetween>
                            </Container>
                        )}
                    </SpaceBetween>
                </div>

                <div style={{ 
                    flex: 1,
                    minWidth: 0,
                    overflow: 'hidden'
                }}>
                    <SpaceBetween size="m">
                        {selectedModelVersion && (
                            <div style={{ overflowX: 'auto' }}>
                                <ModelPipelineVisualizer 
                                    modelVersion={selectedModelVersion}
                                />
                            </div>
                        )}

                        <Container
                            header={<Header variant="h2">Model Output</Header>}
                        >
                            {isLoading ? (
                                <Box textAlign="left" padding="l">
                                    <SpaceBetween size="m" direction="vertical" alignItems="start">
                                        <Spinner size="large" />
                                        <Box variant="p">
                                            Running inference...
                                        </Box>
                                    </SpaceBetween>
                                </Box>
                            ) : results ? (
                                <JsonOutput data={results} />
                            ) : (
                                <Box 
                                    textAlign="left"
                                    color="text-body-secondary" 
                                    padding="l"
                                >
                                    No results yet. Run a prediction to see the output.
                                </Box>
                            )}
                        </Container>
                    </SpaceBetween>
                </div>
            </div>
        </SpaceBetween>
    );
};

export default Predictions;
