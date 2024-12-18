import { generateClient } from 'aws-amplify/api';
import { useContext, useEffect, useState } from 'react';
import amplify_config from '../../../../../amplify_outputs.json';
import { ProjectContext } from '../../../../contexts/ProjectContext';
import { useUser } from '../../../../contexts/UserContext';
import { Model, ModelVersion, Prediction } from '../../../../types/models';
import { generateStoragePath } from '../../../../utils/storageUtils';
import { getS3JSONFromBucket } from '../../../common/utils/S3Utils';

// Define a basic Schema type until we can properly import it
type Schema = {
    models: {
        Model: {
            list: (options?: { filter?: any }) => Promise<{ data: Model[] }>;
        };
        ModelVersion: {
            list: (options?: { filter?: any }) => Promise<{ data: ModelVersion[] }>;
        };
        Prediction: {
            list: (options?: { filter?: any }) => Promise<{ data: Prediction[] }>;
        };
    };
};

const client = generateClient<Schema>();

export const usePredictions = (
    initialModelId?: string,
    initialVersionId?: string
) => {
    const { userInfo } = useUser();
    const { currentProject } = useContext(ProjectContext);
    const [models, setModels] = useState<Model[]>([]);
    const [selectedModel, setSelectedModel] = useState<Model | null>(null);
    const [modelVersions, setModelVersions] = useState<ModelVersion[]>([]);
    const [selectedModelVersion, setSelectedModelVersion] = useState<ModelVersion | null>(null);
    const [predictions, setPredictions] = useState<Prediction[]>([]);
    const [loading, setLoading] = useState(false);
    const [predictionTypeFilter, setPredictionTypeFilter] = useState<'all' | 'ADHOC' | 'BATCH'>('all');
    const [currentPageIndex, setCurrentPageIndex] = useState(1);
    const [isAdhoc, setIsAdhoc] = useState(true);
    const [featureNames, setFeatureNames] = useState<string[]>([]);
    const [featureInputs, setFeatureInputs] = useState<Record<string, string>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [uploadBasePath, setUploadBasePath] = useState('');
    const [fullInputPath, setFullInputPath] = useState<string>('');
    const PAGE_SIZE = 10;

    // Fetch models
    useEffect(() => {
        const fetchModels = async () => {
            if (!currentProject?.id) return;

            try {
                const response = await client.models.Model.list({
                    filter: { projectId: { eq: currentProject.id } }
                });
                setModels(response.data);
            } catch (error) {
                console.error('Error fetching models:', error);
            }
        };
        fetchModels();
    }, [currentProject?.id]);

    // Fetch model versions when model is selected
    useEffect(() => {
        const fetchModelVersions = async () => {
            if (!selectedModel) return;
            try {
                const response = await client.models.ModelVersion.list({
                    filter: { modelId: { eq: selectedModel.id } }
                });
                const sortedVersions = response.data.sort((a: ModelVersion, b: ModelVersion) => b.version - a.version);
                setModelVersions(sortedVersions);
                
                // Auto-select the latest version
                if (sortedVersions.length > 0) {
                    setSelectedModelVersion(sortedVersions[0]);
                }
            } catch (error) {
                console.error('Error fetching model versions:', error);
            }
        };
        fetchModelVersions();
    }, [selectedModel]);

    // Fetch predictions when model version is selected
    useEffect(() => {
        const fetchPredictions = async () => {
            if (!selectedModelVersion) return;
            setLoading(true);
            try {
                const response = await client.models.Prediction.list({
                    filter: { modelVersionId: { eq: selectedModelVersion.id } }
                });
                // Sort predictions by createdAt timestamp, most recent first
                const sortedPredictions = response.data.sort((a: Prediction, b: Prediction) => {
                    const dateA = new Date(a.createdAt || 0).getTime();
                    const dateB = new Date(b.createdAt || 0).getTime();
                    return dateB - dateA;
                });
                setPredictions(sortedPredictions);
            } catch (error) {
                console.error('Error fetching predictions:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchPredictions();
    }, [selectedModelVersion]);

    // Filter predictions based on type
    const filteredPredictions = predictions.filter(prediction => 
        predictionTypeFilter === 'all' || prediction.type === predictionTypeFilter
    );

    const handleFeatureInputChange = (feature: string, value: string) => {
        setFeatureInputs(prev => ({
            ...prev,
            [feature]: value
        }));
    };

    // Add effect to generate upload path when model version changes
    useEffect(() => {
        if (selectedModelVersion && selectedModel && userInfo) {
            const basePath = generateStoragePath({
                userId: userInfo.userId,
                projectId: selectedModel.projectId,
                predictionId: crypto.randomUUID()
            });
            console.debug('Generated upload base path:', {
                userId: userInfo.userId,
                projectId: selectedModel.projectId,
                basePath,
                userInfo
            });
            setUploadBasePath(basePath + "/");
        }
    }, [selectedModelVersion, selectedModel, userInfo]);

    // Add effect to fetch feature names when model version is selected
    useEffect(() => {
        const fetchFeatureNames = async () => {
            if (!selectedModelVersion?.s3OutputPath) return;
            try {
                const feature_names = await getS3JSONFromBucket<string[]>(
                    `${selectedModelVersion.s3OutputPath}/feature_names.json`
                );
                
                if (Array.isArray(feature_names)) {
                    setFeatureNames(feature_names);
                    // Initialize feature inputs
                    const initialInputs = feature_names.reduce<Record<string, string>>((acc, feature) => ({
                        ...acc,
                        [feature]: ''
                    }), {});
                    setFeatureInputs(initialInputs);
                }
            } catch (error) {
                console.error('Error fetching feature names:', error);
                setFeatureNames([]);
            }
        };
        fetchFeatureNames();
    }, [selectedModelVersion]);

    const refreshPredictions = async () => {
        if (!selectedModelVersion) return;
        setLoading(true);
        try {
            const response = await client.models.Prediction.list({
                filter: { modelVersionId: { eq: selectedModelVersion.id } }
            });
            // Sort predictions by createdAt timestamp, most recent first
            const sortedPredictions = response.data.sort((a: Prediction, b: Prediction) => {
                const dateA = new Date(a.createdAt || 0).getTime();
                const dateB = new Date(b.createdAt || 0).getTime();
                return dateB - dateA;
            });
            setPredictions(sortedPredictions);
        } catch (error) {
            console.error('Error fetching predictions:', error);
        } finally {
            setLoading(false);
        }
    };

    const handlePageChange = ({ detail }: { detail: { currentPageIndex: number } }) => {
        setCurrentPageIndex(detail.currentPageIndex);
    };

    // Set initial model when models are loaded
    useEffect(() => {
        if (initialModelId && models.length > 0) {
            const model = models.find(m => m.id === initialModelId);
            if (model) {
                setSelectedModel(model);
            }
        }
    }, [initialModelId, models]);

    // Set initial version when versions are loaded
    useEffect(() => {
        if (initialVersionId && modelVersions.length > 0) {
            const version = modelVersions.find(v => v.id === initialVersionId);
            if (version) {
                setSelectedModelVersion(version);
            }
        }
    }, [initialVersionId, modelVersions]);

    const handleFileProcessed = (file: File | null) => {
        if (!file) return;

        // Construct the full S3 path with the actual filename
        const fullS3Path = `s3://${amplify_config.storage.bucket_name}/${uploadBasePath}${file.name}`;
        setFullInputPath(fullS3Path);
        
        console.debug('File processed, setting full input path:', {
            uploadBasePath,
            fileName: file.name,
            fullS3Path
        });
    };

    return {
        models,
        selectedModel,
        setSelectedModel,
        modelVersions,
        selectedModelVersion,
        setSelectedModelVersion,
        predictions: filteredPredictions,
        predictionTypeFilter,
        setPredictionTypeFilter,
        isAdhoc,
        setIsAdhoc,
        featureNames,
        featureInputs,
        handleFeatureInputChange,
        isLoading,
        setIsLoading,
        paginationProps: {
            currentPageIndex,
            pagesCount: Math.ceil(filteredPredictions.length / PAGE_SIZE),
            onChange: handlePageChange
        },
        loading,
        uploadBasePath,
        handleFileProcessed,
        fullInputPath,
        refreshPredictions
    };
}; 