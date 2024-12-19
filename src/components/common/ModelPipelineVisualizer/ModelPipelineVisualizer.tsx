import { Alert, Box, Container, ExpandableSection, Header, Icon } from '@cloudscape-design/components';
import React, { useEffect, useState } from 'react';
import { ModelVersion, PipelineStep } from '../../../types/models';
import { getPipelineStepIcon, hasCustomIcon } from '../../../utils/PipelineIconUtils';
import { getS3JSONFromBucket } from '../../common/utils/S3Utils';
import styles from './ModelPipelineVisualizer.module.css';

interface ModelPipelineVisualizerProps {
    modelVersion: ModelVersion;
}

const ModelPipelineVisualizer: React.FC<ModelPipelineVisualizerProps> = ({ 
    modelVersion
}) => {
    const [pipeline, setPipeline] = useState<PipelineStep[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchPipeline = async () => {
            try {
                const pipelineData = await getS3JSONFromBucket<PipelineStep[]>(
                    `${modelVersion.s3OutputPath}/best_model_pipeline.json`
                );
                setPipeline(pipelineData || []);
                setError(null);
            } catch (error) {
                console.error('Error fetching pipeline:', error);
                setError('Unable to load pipeline information');
                setPipeline([]);
            }
        };

        if (modelVersion?.s3OutputPath) {
            fetchPipeline();
        }
    }, [modelVersion]);

    if (!modelVersion.status || modelVersion.status !== 'TRAINING_COMPLETED') {
        return null;
    }

    return (
        <Container 
            header={<Header variant="h2">Model Pipeline</Header>}
        >
            {error ? (
                <Alert type="error">{error}</Alert>
            ) : pipeline && pipeline.length > 0 ? (
                <div className={styles.pipelineWrapper}>
                    <div className={styles.pipelineContainer}>
                        {pipeline.map((step, index) => (
                            <React.Fragment key={index}>
                                <div className={styles.stepCard}>
                                    <div className={styles.stepIcon}>
                                        {hasCustomIcon(step) ? (
                                            <img 
                                                src={getPipelineStepIcon(step)} 
                                                alt={step.class_name}
                                                className={styles.stepImage}
                                            />
                                        ) : (
                                            <Icon name="settings" size="big" />
                                        )}
                                    </div>
                                    
                                    <div className={styles.stepDetails}>
                                        <div className={styles.stepName}>{step.class_name}</div>
                                        <div className={styles.stepModule}>{step.module}</div>
                                        <ExpandableSection 
                                            headerText="Parameters" 
                                            variant="footer"
                                            className={styles.stepParams}
                                        >
                                            <pre>{JSON.stringify(step.params, null, 2)}</pre>
                                        </ExpandableSection>
                                    </div>
                                </div>
                                {index < pipeline.length - 1 && (
                                    <div className={styles.arrow}>
                                        <Icon name="angle-right" size="big" />
                                    </div>
                                )}
                            </React.Fragment>
                        ))}
                    </div>
                </div>
            ) : (
                <Box color="text-status-inactive">Loading pipeline information...</Box>
            )}
        </Container>
    );
};

export default ModelPipelineVisualizer; 