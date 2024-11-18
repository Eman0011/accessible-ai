import { Box, Icon, SpaceBetween, StatusIndicator, Alert } from '@cloudscape-design/components';
import React from 'react';
import styles from '../Predictions.module.css';

interface JsonOutputProps {
    data: any;
    isLastStep?: boolean;
}

export const JsonOutput: React.FC<JsonOutputProps> = ({ data, isLastStep = true }) => {
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
        : 'X';
    
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