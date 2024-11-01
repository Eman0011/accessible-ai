import { Button, Form, FormField, Header, Input, Select, SpaceBetween, Textarea } from '@cloudscape-design/components';
import { generateClient } from 'aws-amplify/api';
import React, { useEffect, useState } from 'react';
import type { Schema } from '../../../../amplify/data/resource';
import { getS3JSONFromBucket } from '../../common/utils/S3Utils';

const client = generateClient<Schema>();

const Predictions: React.FC = () => {
    const [models, setModels] = useState<any[]>([]); // Store models
    const [selectedModel, setSelectedModel] = useState<any | null>(null); // Store the entire model object
    const [featureNames, setFeatureNames] = useState<string[]>([]);
    const [inputData, setInputData] = useState<string>(''); // Initialize as an empty string
    const [batchFile, setBatchFile] = useState<File | null>(null);
    const [results, setResults] = useState<any>(null);

    const getBasePath = () => {
        return `${selectedModel.owner}/projects/${selectedModel.projectId}/models/${selectedModel.id}`;
    }

    useEffect(() => {
        const fetchModels = async () => {
            const response = await client.models.Model.list(); // Fetch models from the backend
            setModels(response.data);
        };

        fetchModels();
    }, []);

    useEffect(() => {
        const fetchFeatureNames = async () => {
            if (selectedModel) {
                let basePath = getBasePath();
                console.log('basePath', basePath);
                const feature_names = await getS3JSONFromBucket(`${basePath}/feature_names.json`, TRAINING_OUTPUT_BUCKET)
                setFeatureNames(feature_names);
                console.log(`Features: ${feature_names}`);
            }
        };

        fetchFeatureNames();
    }, [selectedModel]);

    const handleAdhocInference = async () => {
        const response = await client.queries.runModelInference({
            modelPath: getBasePath(),
            input: inputData,
            inputDataPath: 'your_input_data_path',
            outputDataPath: 'your_output_data_path',
            modelVersionId: selectedModel.id
        });
        setResults(response);
    };

    const handleBatchInference = async () => {
        // Logic for handling batch inference
    };

    return (
        <SpaceBetween size="l">
            <Header variant="h1">Run Model Inference</Header>
            <Form>
                <SpaceBetween size="m">
                    <FormField label="Select Model">
                        <Select
                            selectedOption={selectedModel ? { label: selectedModel.name, value: selectedModel.id } : null} // Show model name
                            onChange={({ detail }) => setSelectedModel(models.find(model => model.id === detail.selectedOption.value) || null)} // Set the entire model object
                            options={models.map(model => ({ label: model.name, value: model.id }))} // Use model name for display
                        />
                    </FormField>
                    <FormField label="Ad-hoc Inference Input (JSON)">
                        <Textarea
                            value={inputData}
                            onChange={({ detail }) => setInputData(detail.value)}
                            placeholder={featureNames.length > 0 ? `{"${featureNames[0]}": value1, "${featureNames[1]}": value2}` : 'Select a model to see features'}
                            rows={10} // Set the number of rows for the textarea
                        />
                    </FormField>
                    <Button onClick={handleAdhocInference} disabled={!selectedModel}>Run Ad-hoc Inference</Button>
                    <FormField label="Batch Inference File">
                        <Input
                            type="file"
                            onChange={({ target }) => setBatchFile(target.files[0])}
                        />
                    </FormField>
                    <Button onClick={handleBatchInference}>Run Batch Inference</Button>
                </SpaceBetween>
            </Form>
            {results && <div>Results: {JSON.stringify(results)}</div>}
        </SpaceBetween>
    );
};

export default Predictions;
