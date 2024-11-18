import { FormField, Select } from '@cloudscape-design/components';
import React from 'react';
import { ModelVersion } from '../../../../types/models';

interface VersionSelectorProps {
    modelVersions: ModelVersion[];
    selectedVersion: ModelVersion | null;
    onVersionSelect: (version: ModelVersion | null) => void;
}

export const VersionSelector: React.FC<VersionSelectorProps> = ({
    modelVersions = [],
    selectedVersion,
    onVersionSelect
}) => (
    <div style={{ maxWidth: '400px' }}>
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
                    onVersionSelect(version || null);
                }}
                options={modelVersions.map(version => ({
                    label: `Version ${version.version} (${new Date(version.createdAt || '').toLocaleDateString()})`,
                    value: version.id,
                    description: version.status
                }))}
                placeholder="Select a version"
            />
        </FormField>
    </div>
); 