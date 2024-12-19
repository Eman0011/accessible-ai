import { Box, SpaceBetween, StatusIndicator } from '@cloudscape-design/components';
import React from 'react';
import styles from '../Predictions.module.css';

interface JsonOutputProps {
    data: any;
}

export const JsonOutput: React.FC<JsonOutputProps> = ({ data }) => {
    // Handle null or undefined data
    if (!data) {
        return (
            <Box color="text-status-error">
                No data available
            </Box>
        );
    }

    // If data is a string, try to parse it
    if (typeof data === 'string') {
        try {
            data = JSON.parse(data);
        } catch (e) {
            return (
                <Box color="text-status-error">
                    Invalid JSON data
                </Box>
            );
        }
    }

    // Handle error responses
    if (data.statusCode === 500 || data.error) {
        return (
            <SpaceBetween size="s">
                <StatusIndicator type="error">
                    {data.error?.message || data.message || 'A Server Error Occurred'}
                </StatusIndicator>
            </SpaceBetween>
        );
    }

    // Handle successful responses
    const result = data.body || data;
    const displayValue = Array.isArray(result) ? result[0] : result;

    return (
        <SpaceBetween size="s">
            <div className={styles.pipelineContainer}>
                <div className={styles['step-card']}>
                    <div className={styles['step-title']}>
                        Prediction Result
                    </div>
                    <div className={styles['result-circle']}>
                        <div className={styles['result-value']}>
                            {typeof displayValue === 'object' 
                                ? JSON.stringify(displayValue, null, 2)
                                : displayValue?.toString() || 'No result available'
                            }
                        </div>
                    </div>
                </div>
            </div>
            <StatusIndicator type="success">
                Model prediction successful!
            </StatusIndicator>
        </SpaceBetween>
    );
}; 