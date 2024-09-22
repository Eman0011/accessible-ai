import { generateClient } from "aws-amplify/api";
import { Card } from 'primereact/card';
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { Schema } from "../../../../amplify/data/resource";
import { Model } from '../../../types/models';

const client = generateClient<Schema>();

const ModelDetails: React.FC = () => {
  const { modelId } = useParams<{ modelId: string }>();
  const [model, setModel] = useState<Model | null>(null);

  useEffect(() => {
    const fetchModel = async () => {
      try {
        const result = await client.models.Model.get({ id: modelId });
        setModel(result.data as unknown as Model); // Convert to unknown first
      } catch (error) {
        console.error('Error fetching model:', error);
      }
    };

    if (modelId) {
      fetchModel();
    }
  }, [modelId]);

  if (!model) {
    return <div>Loading...</div>;
  }

  return (
    <Card title={model.name}>
      <p><strong>Description:</strong> {model.description}</p>
      <p><strong>Owner:</strong> {model.owner}</p>
      <p><strong>Version:</strong> {model.version}</p>
      <p><strong>Status:</strong> {model.status}</p>
      {model.targetFeature && <p><strong>Target Feature:</strong> {model.targetFeature}</p>}
      {model.fileUrl && (
        <p>
          <strong>File URL:</strong> 
          <a href={model.fileUrl} target="_blank" rel="noopener noreferrer">{model.fileUrl}</a>
        </p>
      )}
    </Card>
  );
};

export default ModelDetails;