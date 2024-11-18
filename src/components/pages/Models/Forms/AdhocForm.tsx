import { FormField, Input, SpaceBetween } from '@cloudscape-design/components';
import React from 'react';

interface AdhocFormProps {
    featureNames: string[];
    featureInputs: Record<string, string>;
    onFeatureInputChange: (feature: string, value: string) => void;
    isLoading: boolean;
}

export const AdhocForm: React.FC<AdhocFormProps> = ({
    featureNames,
    featureInputs,
    onFeatureInputChange,
    isLoading
}) => (
    <SpaceBetween size="m">
        {featureNames.map(feature => (
            <FormField key={feature} label={feature}>
                <Input
                    value={featureInputs[feature] || ''}
                    onChange={({ detail }) => onFeatureInputChange(feature, detail.value)}
                    disabled={isLoading}
                />
            </FormField>
        ))}
    </SpaceBetween>
); 