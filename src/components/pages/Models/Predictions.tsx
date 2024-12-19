import { Box, Container, Header, Link, SpaceBetween, Table, Tabs } from '@cloudscape-design/components';
import { generateClient } from 'aws-amplify/api';
import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import type { Schema } from '../../../../amplify/data/resource';
import amplify_config from '../../../../amplify_outputs.json';
import { TRAINING_OUTPUT_BUCKET } from '../../../../Config';
import { useUser } from '../../../contexts/UserContext';
import { Prediction } from '../../../types/models';
import { generatePredictionOutputPath } from '../../../utils/storageUtils';
import { ModelSelector } from './components/ModelSelector';
import { VersionSelector } from './components/VersionSelector';
import { usePredictions } from './hooks/usePredictions';
import { HistoryTab } from './PredictionTabs/HistoryTab';
import { MakePredictionTab } from './PredictionTabs/MakePredictionTab';
const client = generateClient<Schema>();

const Predictions: React.FC = () => {
    const location = useLocation();
    const navigationState = location.state as { 
        selectedModelId?: string;
        selectedModelVersionId?: string;
    } | undefined;

    const { userInfo } = useUser();
    const [activeTab, setActiveTab] = useState('predict');
    const [adhocInputMode, setAdhocInputMode] = useState<'form' | 'json'>('form');
    const [jsonInput, setJsonInput] = useState('');
    const [results, setResults] = useState<any>(null);
    const [selectedPrediction, setSelectedPrediction] = useState<Prediction>();
    const [batchResults, setBatchResults] = useState<any[]>([]);
    const [inputData, setInputData] = useState<string[][]>([]);
    const [outputPath, setOutputPath] = useState<string | null>('');

    const {
        models,
        selectedModel,
        setSelectedModel,
        modelVersions,
        selectedModelVersion,
        setSelectedModelVersion,
        predictions,
        predictionTypeFilter,
        setPredictionTypeFilter,
        isAdhoc,
        setIsAdhoc,
        featureNames,
        featureInputs,
        handleFeatureInputChange,
        isLoading,
        setIsLoading,
        paginationProps,
        loading,
        uploadBasePath,
        handleFileProcessed,
        fullInputPath,
        refreshPredictions
    } = usePredictions(navigationState?.selectedModelId, navigationState?.selectedModelVersionId);

    const handleAdhocPrediction = async (modelVersion: any, username: string) => {
        let inputData: Record<string, any>;
        if (adhocInputMode === 'json') {
            try {
                inputData = JSON.parse(jsonInput);
            } catch (error) {
                console.error('Invalid JSON input:', error);
                throw new Error('Invalid JSON input');
            }
        } else {
            inputData = Object.entries(featureInputs).reduce((acc, [key, value]) => ({
                ...acc,
                [key]: isNaN(Number(value)) ? value : Number(value)
            }), {});
        }

        const predictionId = crypto.randomUUID();

        console.debug('Creating adhoc prediction:', {
            predictionId,
            modelVersionId: modelVersion.id,
            inputData,
            username
        });

        // Create initial prediction record
        await client.models.Prediction.create({
            id: predictionId,
            modelVersionId: modelVersion.id,
            projectId: selectedModel!.projectId,
            type: 'ADHOC',
            status: 'PENDING',
            submittedBy: username,
            adhocInput: JSON.stringify(inputData),
            startTime: new Date().toISOString()
        });

        try {
            const payload = {
                predictionId: predictionId,
                modelVersionId: modelVersion.id,
                basePath: modelVersion.s3OutputPath,
                targetFeature: modelVersion.targetFeature,
                submittedBy: username,
                input: JSON.stringify(inputData)
            };

            const response = await client.queries.runModelInference(payload);
            console.debug('Received inference response:', response);
            
            if (response.errors) {
                throw new Error(response.errors[0]?.message || 'Unknown error occurred');
            }

            // Parse the response
            let parsedResponse;
            try {
                if (typeof response.data === 'string') {
                    parsedResponse = JSON.parse(response.data);
                } else {
                    console.warn('Response data is not a string:', response.data);
                    parsedResponse = response.data; // Handle the case where it's not a string
                }
            } catch (error) {
                console.error('Error parsing prediction response:', error);
                throw new Error('Failed to parse prediction response');
            }

            return parsedResponse;
        } catch (error) {
            // Only update status on failure
            await client.models.Prediction.update({
                id: predictionId,
                status: 'FAILED',
                error: error instanceof Error ? error.message : 'Unknown error',
                endTime: new Date().toISOString()
            });
            
            throw error;
        }
    };

    const handleBatchPrediction = async (modelVersion: any, username: string) => {
        if (!fullInputPath) {
            throw new Error('No batch input data provided');
        }

        const predictionId = crypto.randomUUID();

        console.debug('Creating batch prediction:', {
            inputPath: fullInputPath,
            bucket: amplify_config.storage.bucket_name
        });

        const relativeOutputPath = generatePredictionOutputPath({
            projectId: selectedModel!.projectId,
            modelId: modelVersion.id,
            predictionId: predictionId,
            fileName: 'predictions.csv',
            type: 'BATCH'
        });

        const fullOutputPath = `s3://${TRAINING_OUTPUT_BUCKET}/${relativeOutputPath}`;
        setOutputPath(fullOutputPath);

        // Create initial prediction record
        await client.models.Prediction.create({
            id: predictionId,
            modelVersionId: modelVersion.id,
            projectId: selectedModel!.projectId,
            type: 'BATCH',
            status: 'PENDING',
            submittedBy: username,
            inputDataPath: fullInputPath,
            outputDataPath: fullOutputPath,
            startTime: new Date().toISOString()
        });

        try {
            const response = await client.queries.runModelInference({
                predictionId: predictionId,
                modelVersionId: modelVersion.id,
                targetFeature: modelVersion.targetFeature,
                basePath: modelVersion.s3OutputPath,
                submittedBy: username,
                inputDataPath: fullInputPath,
                outputDataPath: fullOutputPath,
            });

            let predictions: string[] = [];
            if (response.data) {
                try {
                    const parsedResponse = typeof response.data === 'string'
                        ? JSON.parse(response.data)
                        : response.data;
                    if (parsedResponse.body) {
                        predictions = typeof parsedResponse.body === 'string' 
                            ? JSON.parse(parsedResponse.body)
                            : parsedResponse.body;
                    }
                } catch (error) {
                    console.error('Error parsing batch predictions:', error);
                }
            }

            return {
                results: predictions.map((prediction, index) => ({
                    index: index + 1,
                    prediction: prediction,
                })),
                outputPath: fullOutputPath
            };
        } catch (error) {
            // Only update status on failure
            await client.models.Prediction.update({
                id: predictionId,
                status: 'FAILED',
                error: error instanceof Error ? error.message : 'Unknown error',
                endTime: new Date().toISOString()
            });
            
            throw error;
        }
    };

    const handleSubmit = async () => {
        if (!selectedModelVersion || !userInfo?.username) {
            console.error('Missing required fields:', {
                hasModelVersion: !!selectedModelVersion,
                hasUsername: !!userInfo?.username
            });
            return;
        }

        setIsLoading(true);
        try {
            const result = isAdhoc 
                ? await handleAdhocPrediction(selectedModelVersion, userInfo.username)
                : await handleBatchPrediction(selectedModelVersion, userInfo.username);
            
            setResults(result);
            
            // Refresh predictions history after successful prediction
            await refreshPredictions();
            
        } catch (error) {
            console.error('Prediction error:', error);
            // TODO: Show error alert
        } finally {
            setIsLoading(false);
        }
    };

    const handleCopyPrediction = (prediction: Prediction) => {
        if (prediction.type === 'ADHOC' && prediction.adhocInput) {
            try {
                const input = JSON.parse(prediction.adhocInput);
                
                // Set JSON input
                setJsonInput(JSON.stringify(input, null, 2));
                
                // Set form inputs
                Object.entries(input).forEach(([key, value]) => {
                    handleFeatureInputChange(key, value?.toString() || '');
                });
                
                // Switch to prediction tab
                setActiveTab('predict');
                
                // Optionally, you can choose which input mode to show
                setAdhocInputMode('form'); // or 'json' depending on preference
                
                // Make sure we're in adhoc mode
                setIsAdhoc(true);
                
                console.debug('Copied prediction input:', {
                    input,
                    prediction
                });
            } catch (e) {
                console.error('Error parsing prediction input:', e);
            }
        }
    };

    const makePredictionProps = {
        selectedModel,
        selectedModelVersion,
        isAdhoc,
        setIsAdhoc,
        featureNames,
        featureInputs,
        onFeatureInputChange: handleFeatureInputChange,
        isLoading,
        onSubmit: handleSubmit,
        uploadBasePath,
        onFileProcessed: handleFileProcessed,
        results,
        adhocInputMode,
        setAdhocInputMode,
        jsonInput,
        setJsonInput,
        batchResults,
        inputData,
        setInputData,
        outputPath: outputPath || '',
    };

    const historyProps = {
        predictions,
        loading,
        predictionTypeFilter,
        setPredictionTypeFilter,
        paginationProps,
        onCopyPrediction: handleCopyPrediction,
        selectedPrediction,
        onSelectionChange: setSelectedPrediction,
        onRefresh: refreshPredictions
    };

    return (
        <SpaceBetween size="l">
            <Header variant="h1">
                {activeTab === 'predict' ? 'Run Model Predictions' : 'Prediction History'}
            </Header>

            <Container>
                <SpaceBetween size="m">
                    <ModelSelector 
                        models={models}
                        selectedModel={selectedModel}
                        onModelSelect={setSelectedModel}
                    />
                    
                    {selectedModel && (
                        <>
                            <VersionSelector
                                modelVersions={modelVersions}
                                selectedVersion={selectedModelVersion}
                                onVersionSelect={setSelectedModelVersion}
                            />
                            <Box variant="p" color="text-body-secondary">
                                {selectedModel.description}
                            </Box>
                        </>
                    )}
                </SpaceBetween>
            </Container>

            {selectedModelVersion && (
                <Tabs
                    activeTabId={activeTab}
                    onChange={({ detail }) => setActiveTab(detail.activeTabId)}
                    tabs={[
                        {
                            id: "predict",
                            label: "Make Prediction",
                            content: <MakePredictionTab {...makePredictionProps} />
                        },
                        {
                            id: "history",
                            label: "History",
                            content: <HistoryTab {...historyProps} />
                        }
                    ]}
                />
            )}
        </SpaceBetween>
    );
};

// Create a new component for displaying batch results
const BatchResultsTable: React.FC<{
    results: Array<{
        index: number;
        prediction: string;
    }>;
    targetFeature: string;
    outputPath: string;
}> = ({ results, targetFeature, outputPath }) => {
    if (!results || results.length === 0) {
        return (
            <Box textAlign="center" color="inherit">
                <b>Processing Batch Predictions</b>
                <Box padding={{ bottom: 's' }} variant="p" color="inherit">
                    Results will be available for download when complete.
                </Box>
                <Link href={outputPath}>Download Results CSV</Link>
            </Box>
        );
    }

    return (
        <Table
            columnDefinitions={[
                {
                    id: 'index',
                    header: 'Row',
                    cell: item => item.index
                },
                {
                    id: 'prediction',
                    header: `Predicted ${targetFeature}`,
                    cell: item => item.prediction
                },
                {
                    id: 'actions',
                    header: 'Actions',
                    cell: () => (
                        <Link href={outputPath}>
                            Download Full Results
                        </Link>
                    )
                }
            ]}
            resizableColumns
            items={results}
            variant="embedded"
            stripedRows
            empty={
                <Box textAlign="center" color="inherit">
                    <b>No results available</b>
                    <Box padding={{ bottom: 's' }} variant="p" color="inherit">
                        Run a batch prediction to see results.
                    </Box>
                </Box>
            }
        />
    );
};

export default Predictions;
