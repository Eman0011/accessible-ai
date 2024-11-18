import { SpaceBetween, Header, Container, Tabs, Button, Box } from '@cloudscape-design/components';
import React, { useState } from 'react';
import { ModelSelector } from './components/ModelSelector';
import { VersionSelector } from './components/VersionSelector';
import { MakePredictionTab } from './PredictionTabs/MakePredictionTab';
import { HistoryTab } from './PredictionTabs/HistoryTab';
import { usePredictions } from './hooks/usePredictions';
import { generateClient } from 'aws-amplify/api';
import { useUser } from '../../../contexts/UserContext';
import type { Schema } from '../../../../amplify/data/resource';
import { Prediction } from '../../../../types/models';
import { useLocation } from 'react-router-dom';

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
        refreshPredictions
    } = usePredictions(navigationState?.selectedModelId, navigationState?.selectedModelVersionId);

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
            if (isAdhoc) {
                let inputData: Record<string, any>;
                if (adhocInputMode === 'json') {
                    try {
                        inputData = JSON.parse(jsonInput);
                    } catch (error) {
                        console.error('Invalid JSON input:', error);
                        return;
                    }
                } else {
                    inputData = Object.entries(featureInputs).reduce((acc, [key, value]) => ({
                        ...acc,
                        [key]: isNaN(Number(value)) ? value : Number(value)
                    }), {});
                }

                console.debug('Submitting adhoc prediction:', {
                    modelVersionId: selectedModelVersion.id,
                    inputData,
                    username: userInfo.username
                });

                const payload = {
                    modelVersionId: selectedModelVersion.id,
                    basePath: selectedModelVersion.s3OutputPath,
                    targetFeature: selectedModelVersion.targetFeature,
                    submittedBy: userInfo.username,
                    input: JSON.stringify(inputData)
                };

                const response = await client.queries.runModelInference(payload);
                console.debug('Received inference response:', response);
                
                // Parse the response properly
                let parsedResponse;
                try {
                    parsedResponse = typeof response.data === 'string' 
                        ? JSON.parse(response.data) 
                        : response.data;
                    
                    if (parsedResponse.data && typeof parsedResponse.data === 'string') {
                        parsedResponse = JSON.parse(parsedResponse.data);
                    }
                } catch (error) {
                    console.error('Error parsing response:', error);
                    throw new Error('Failed to parse prediction response');
                }
                
                // Create prediction record with properly parsed data
                const prediction = await client.models.Prediction.create({
                    id: crypto.randomUUID(),
                    modelVersionId: selectedModelVersion.id,
                    projectId: selectedModel!.projectId,
                    type: 'ADHOC',
                    status: 'COMPLETED',
                    submittedBy: userInfo.username,
                    adhocInput: JSON.stringify(inputData),
                    adhocOutput: JSON.stringify(parsedResponse),
                    startTime: new Date().toISOString(),
                    endTime: new Date().toISOString()
                });

                console.debug('Created prediction record:', prediction);
                setResults(parsedResponse);
            }

            // After successful prediction, refresh the predictions list
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
        results,
        adhocInputMode,
        setAdhocInputMode,
        jsonInput,
        setJsonInput
    };

    const historyProps = {
        predictions,
        loading,
        predictionTypeFilter,
        setPredictionTypeFilter,
        paginationProps,
        onRefresh: refreshPredictions,
        onCopyPrediction: handleCopyPrediction,
        selectedPrediction,
        onSelectionChange: setSelectedPrediction
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

export default Predictions;
