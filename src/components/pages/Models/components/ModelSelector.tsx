import { FormField, Select } from '@cloudscape-design/components';
import React from 'react';
import { Model } from '../../../../types/models';

interface ModelSelectorProps {
    models: Model[];
    selectedModel: Model | null;
    onModelSelect: (model: Model | null) => void;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({ 
    models, 
    selectedModel, 
    onModelSelect 
}) => (
    <div style={{ maxWidth: '400px' }}>
        <FormField
            label="Select Model"
            description="Choose a model to run predictions with"
        >
            <Select
                selectedOption={selectedModel ? { label: selectedModel.name, value: selectedModel.id } : null}
                onChange={({ detail }) => 
                    onModelSelect(models.find(model => model.id === detail.selectedOption.value) || null)
                }
                options={models.map(model => ({ 
                    label: model.name, 
                    value: model.id,
                    description: model.description 
                }))}
                placeholder="Choose a model"
            />
        </FormField>
    </div>
); 