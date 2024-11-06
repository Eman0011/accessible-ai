import { FileUploader } from '@aws-amplify/ui-react-storage';
import { Box, Button, Form, FormField, Header, Input, Select, SpaceBetween, Tabs, Textarea, Toggle } from '@cloudscape-design/components';
import { generateClient } from 'aws-amplify/api';
import Papa from 'papaparse';
import React, { useEffect, useState } from 'react';
import type { Schema } from '../../../../amplify/data/resource';
import { PREDICTIONS_OUTPUT_BUCKET, TRAINING_OUTPUT_BUCKET } from '../../../../Config';
import { useUser } from '../../../contexts/UserContext';
import { Model, ModelVersion } from '../../../types/models';
import { generateStoragePath } from '../../../utils/storageUtils';
import DatasetVisualizer from '../../common/DatasetVisualizer';
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
}

const AdhocForm: React.FC<AdhocFormProps> = ({ featureNames, featureInputs, onFeatureInputChange }) => (
    <SpaceBetween size="m">
        {featureNames.map(feature => (
            <FormField key={feature} label={feature}>
                <Input
                    value={featureInputs[feature] || ''}
                    onChange={({ detail }) => onFeatureInputChange(feature, detail.value)}
                />
            </FormField>
        ))}
    </SpaceBetween>
);

interface JsonInputProps {
    jsonInput: string;
    jsonError: string | null;
    onJsonChange: (value: string) => void;
}

const JsonInput: React.FC<JsonInputProps> = ({ jsonInput, jsonError, onJsonChange }) => (
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
        />
    </FormField>
);

const Predictions: React.FC = () => {
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
        };
        fetchModels();
    }, []);

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

                if (sortedVersions.length > 0) {
                    setSelectedModelVersion(sortedVersions[0]);
                }
            }
        };

        if (selectedModel) {
            fetchModelVersions();
        }
    }, [selectedModel]);

    useEffect(() => {
        const fetchFeatureNames = async () => {
            if (selectedModelVersion) {
                const feature_names = await getS3JSONFromBucket(
                    `${selectedModelVersion.s3OutputPath}/feature_names.json`,
                    TRAINING_OUTPUT_BUCKET
                ) as string[];
                
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
        if (!selectedModelVersion) return;

        let inputData: Record<string, string>;
        if (adhocInputMode === 'json') {
            const parsed = validateAndParseJSON(jsonInput);
            if (!parsed) return;
            inputData = parsed;
        } else {
            inputData = featureInputs;
        }

        const payload = {
            modelPath: selectedModelVersion.s3OutputPath,
            input: inputData,
            modelVersionId: selectedModelVersion.id
        };

        const response = await client.queries.runModelInference(payload);
        setResults(response);
    };

    const handleBatchInference = async () => {
        if (!batchFile || !selectedModelVersion) return;

        const payload = {
            modelPath: selectedModelVersion.s3OutputPath,
            inputDataPath: `s3://${PREDICTIONS_OUTPUT_BUCKET}/test_inference/${batchFile.name}`,
        };

        const response = await client.queries.runModelInference(payload);
        setResults(response);
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
            
            <ModelSelector 
                models={models}
                selectedModel={selectedModel}
                onModelSelect={setSelectedModel}
            />

            {selectedModel && (
                <Form>
                    <SpaceBetween size="m">
                        <VersionSelector
                            modelVersions={modelVersions}
                            selectedVersion={selectedModelVersion}
                            onVersionSelect={setSelectedModelVersion}
                        />

                        {selectedModelVersion && (
                            <>
                                <SpaceBetween size="s">
                                    <Header variant="h3">Prediction Type</Header>
                                    <Box>
                                        <div style={{ 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            gap: '1rem',
                                        }}>
                                            <Box color={isAdhocMode ? 'text-label' : 'text-body-secondary'}>
                                                Ad-hoc
                                            </Box>
                                            <Toggle
                                                onChange={({ detail }) => setIsAdhocMode(!detail.checked)}
                                                checked={!isAdhocMode}
                                            />
                                            <Box color={!isAdhocMode ? 'text-label' : 'text-body-secondary'}>
                                                Batch
                                            </Box>
                                        </div>
                                    </Box>
                                </SpaceBetween>

                                {isAdhocMode ? (
                                    <>
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
                                            disabled={!selectedModelVersion || (adhocInputMode === 'json' && !!jsonError)}
                                        >
                                            Run Ad-hoc Prediction
                                        </Button>
                                    </>
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
                                            disabled={!selectedModelVersion || !batchFile}
                                        >
                                            Run Batch Inference
                                        </Button>
                                    </SpaceBetween>
                                )}
                            </>
                        )}
                    </SpaceBetween>
                </Form>
            )}

            {results && (
                <FormField label="Results">
                    <pre style={{ maxHeight: '200px', overflow: 'auto' }}>
                        {JSON.stringify(results, null, 2)}
                    </pre>
                </FormField>
            )}
        </SpaceBetween>
    );
};

export default Predictions;
