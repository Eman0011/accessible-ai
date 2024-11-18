import { Container, SpaceBetween, Toggle, Box, Header, Spinner, Tabs, FormField, Textarea, SegmentedControl, Button, Table } from '@cloudscape-design/components';
import React, { useState, useEffect, useRef } from 'react';
import { Model, ModelVersion } from '../../../../types/models';
import { AdhocForm } from '../Forms/AdhocForm';
import { BatchForm } from '../Forms/BatchForm';
import ModelPipelineVisualizer from '../../../common/ModelPipelineVisualizer/ModelPipelineVisualizer';
import { JsonOutput } from '../components/JsonOutput';
import styles from '../Predictions.module.css';
import tableStyles from '../../../common/TableStyles.module.css';

interface MakePredictionTabProps {
    selectedModel: Model | null;
    selectedModelVersion: ModelVersion | null;
    isAdhoc: boolean;
    setIsAdhoc: (value: boolean) => void;
    featureNames: string[];
    featureInputs: Record<string, string>;
    onFeatureInputChange: (feature: string, value: string) => void;
    isLoading: boolean;
    onSubmit: () => void;
    uploadBasePath?: string;
    onFileProcessed?: (file: File) => void;
    results?: any;
    adhocInputMode: 'form' | 'json';
    setAdhocInputMode: (mode: 'form' | 'json') => void;
    jsonInput: string;
    setJsonInput: (input: string) => void;
}

export const MakePredictionTab: React.FC<MakePredictionTabProps> = ({
    selectedModel,
    selectedModelVersion,
    isAdhoc,
    setIsAdhoc,
    featureNames,
    featureInputs,
    onFeatureInputChange,
    isLoading,
    onSubmit,
    uploadBasePath,
    onFileProcessed,
    results,
    adhocInputMode,
    setAdhocInputMode,
    jsonInput,
    setJsonInput
}) => {
    const [jsonError, setJsonError] = useState<string | null>(null);
    const rightColumnRef = useRef<HTMLDivElement>(null);
    const leftColumnRef = useRef<HTMLDivElement>(null);

    // Validate and parse JSON, update form inputs if valid
    const validateAndParseJSON = (jsonString: string): Record<string, any> | null => {
        try {
            const parsed = JSON.parse(jsonString);
            setJsonError(null);

            // Update form inputs when JSON is valid
            Object.entries(parsed).forEach(([key, value]) => {
                if (featureNames.includes(key)) {
                    onFeatureInputChange(key, value?.toString() || '');
                }
            });

            return parsed;
        } catch (error) {
            setJsonError('Invalid JSON format');
            return null;
        }
    };

    // Update JSON when form inputs change
    useEffect(() => {
        // Convert form values to appropriate types (number or string)
        const typedInputs = Object.entries(featureInputs).reduce((acc, [key, value]) => ({
            ...acc,
            [key]: isNaN(Number(value)) || value === '' ? value : Number(value)
        }), {});
        
        setJsonInput(JSON.stringify(typedInputs, null, 2));
    }, [featureInputs]);

    const handleSubmit = () => {
        onSubmit();
        
        // Always scroll right column into view
        setTimeout(() => {
            if (rightColumnRef.current) {
                rightColumnRef.current.scrollIntoView({ 
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        }, 100);
    };

    return (
        <div style={{ display: 'flex', width: '100%', gap: '24px', flexDirection: 'row', flexWrap: 'wrap' }}>
            <div ref={leftColumnRef} style={{ width: '400px', minWidth: '300px', flex: '1 0 auto' }}>
                <SpaceBetween size="m">
                    <Container
                        header={
                            <Header 
                                variant="h2"
                                description={isAdhoc ? 
                                    "Make a single prediction with specific input values" : 
                                    "Run predictions on multiple inputs using a CSV file"
                                }
                                actions={
                                    <Button
                                        variant="primary"
                                        onClick={handleSubmit}
                                        loading={isLoading}
                                        disabled={isLoading}
                                    >
                                        {isAdhoc ? "Run Prediction" : "Run Batch Predictions"}
                                    </Button>
                                }
                            >
                                {isAdhoc ? "Ad-hoc Prediction" : "Batch Prediction"}
                            </Header>
                        }
                    >
                        <SpaceBetween size="l">
                            <SegmentedControl
                                selectedId={isAdhoc ? 'adhoc' : 'batch'}
                                onChange={({ detail }) => 
                                    setIsAdhoc(detail.selectedId === 'adhoc')
                                }
                                label="Prediction Type"
                                options={[
                                    { id: 'adhoc', text: 'Ad-hoc' },
                                    { id: 'batch', text: 'Batch' }
                                ]}
                            />

                            {isAdhoc ? (
                                <SpaceBetween size="m">
                                    <Container
                                        header={
                                            <Header variant="h3">
                                                Input Features
                                            </Header>
                                        }
                                    >
                                        <SpaceBetween size="m">
                                            <SegmentedControl 
                                                selectedId={adhocInputMode}
                                                onChange={({ detail }) => 
                                                    setAdhocInputMode(detail.selectedId as 'form' | 'json')
                                                }
                                                label="Input Type"
                                                options={[
                                                    { id: 'form', text: 'Form Input' },
                                                    { id: 'json', text: 'JSON Input' }
                                                ]}
                                            />

                                            {adhocInputMode === 'form' ? (
                                                <AdhocForm
                                                    featureNames={featureNames}
                                                    featureInputs={featureInputs}
                                                    onFeatureInputChange={onFeatureInputChange}
                                                    isLoading={isLoading}
                                                />
                                            ) : (
                                                <FormField 
                                                    label="JSON Input"
                                                    errorText={jsonError}
                                                    className={styles['json-input-container']}
                                                >
                                                    <Textarea
                                                        value={jsonInput}
                                                        onChange={({ detail }) => {
                                                            setJsonInput(detail.value);
                                                            validateAndParseJSON(detail.value);
                                                        }}
                                                        rows={20}
                                                        className={styles['json-input']}
                                                        disabled={isLoading}
                                                    />
                                                </FormField>
                                            )}
                                        </SpaceBetween>
                                    </Container>
                                </SpaceBetween>
                            ) : (
                                <Container
                                    header={
                                        <Header variant="h3">
                                            Batch Input File
                                        </Header>
                                    }
                                >
                                    <BatchForm
                                        uploadBasePath={uploadBasePath || ''}
                                        onFileProcessed={onFileProcessed || (() => {})}
                                        isLoading={isLoading}
                                    />
                                </Container>
                            )}

                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <Button
                                    variant="primary"
                                    onClick={handleSubmit}
                                    loading={isLoading}
                                    disabled={isLoading}
                                >
                                    {isAdhoc ? "Run Prediction" : "Run Batch Predictions"}
                                </Button>
                            </div>
                        </SpaceBetween>
                    </Container>
                </SpaceBetween>
            </div>

            <div 
                ref={rightColumnRef}
                style={{ 
                    flex: '2 1 400px',  // Grow more than left column, shrink if needed
                    minWidth: 0,
                    overflow: 'hidden'
                }}
            >
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
    );
}; 