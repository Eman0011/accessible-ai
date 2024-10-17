import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import {
  ColumnLayout,
  Container,
  Header,
  SpaceBetween,
  Spinner,
  Table,
  StatusIndicator
} from '@cloudscape-design/components';
import { generateClient } from "aws-amplify/api";
import { fetchAuthSession } from 'aws-amplify/auth';
import React, { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import { useParams } from 'react-router-dom';
import type { Schema } from "../../../../amplify/data/resource";
import { TRAINING_OUTPUT_BUCKET } from '../../../../Config';
import { Model } from '../../../types/models';

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const client = generateClient<Schema>();

interface ModelMetrics {
  accuracy: number;
  confusion_matrix: {
    true_negatives: number;
    false_positives: number;
    false_negatives: number;
    true_positives: number;
  };
  classification_report: {
    [key: string]: {
      precision: number;
      recall: number;
      f1_score: number;
      support: number;
    };
  };
  roc_auc: number;
  cv_score: number;
  auc_data: {
    fpr: number[];
    tpr: number[];
  };
}

interface PipelineStep {
  step_name: string;
  class_name: string;
  module: string;
  params: { [key: string]: any };
}

interface AUCData {
  fpr: number[];
  tpr: number[];
}

const ModelDetails: React.FC = () => {
  const { modelId } = useParams<{ modelId: string }>();
  const [metrics, setMetrics] = useState<ModelMetrics | null>(null);
  const [pipeline, setPipeline] = useState<PipelineStep[]>([]);
  const [model, setModel] = useState<Model | null>(null);
  const [loading, setLoading] = useState(true);
  const [aucData, setAucData] = useState<AUCData | null>(null);

  const getS3Object = async (key: string) => {
    try {
      const session = await fetchAuthSession();
      const s3Client = new S3Client({
        region: 'us-east-1', // Make sure this is the correct region
        credentials: session.credentials,
      });

      const command = new GetObjectCommand({
        Bucket: TRAINING_OUTPUT_BUCKET,
        Key: key,
      });

      const response = await s3Client.send(command);
      const str = await response.Body?.transformToString();
      return JSON.parse(str || '{}');
    } catch (error) {
      console.error('Error downloading S3 object:', error);
      throw error;
    }
  };

  const generateSampleAUCData = (auc: number): AUCData => {
    const fpr = [0, 0.0001, 0.001, 0.01, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 0.99, 0.999, 0.9999, 1];
    const tpr = fpr.map(x => {
      const y = Math.pow(x, (1 / auc - 1));
      return Math.max(0, Math.min(1, y + (Math.random() - 0.5) * 0.1));
    });
    return { fpr, tpr };
  };

  useEffect(() => {
    const fetchModelDetails = async () => {
      try {
        const modelResponse = await client.models.Model.get({ id: modelId });
        const modelData: Model = modelResponse.data as unknown as Model;
        setModel(modelData);

        if (modelData.status === 'TRAINING_COMPLETED') {
          let s3OutputPath = `${modelData.owner}/projects/${modelData.projectId}/models/${modelData.id}`;
          console.log('s3OutputPath', s3OutputPath);

          // Fetch metrics
          const metricsData: ModelMetrics = await getS3Object(`${s3OutputPath}/best_model_metrics.json`);
          setMetrics(metricsData);
          console.log('metricsData', metricsData);

          // Fetch pipeline
          const pipelineData: PipelineStep[] = await getS3Object(`${s3OutputPath}/best_model_pipeline.json`);
          setPipeline(pipelineData);
          console.log('pipelineData', pipelineData);

          // Set AUC data
          if (metricsData.auc_data) {
            setAucData(metricsData.auc_data);
          } else {
            setAucData(generateSampleAUCData(metricsData.roc_auc));
          }
        }
      } catch (error) {
        console.error('Error fetching model details:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchModelDetails();
  }, [modelId]);

  if (loading) {
    return <Spinner size="large" />;
  }

  if (!model) {
    return <div>Error loading model details. Please try again.</div>;
  }

  const formatNumber = (value: number | undefined) => {
    return value !== undefined ? value.toFixed(4) : '-';
  };

  const aucChartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'ROC Curve',
        font: {
          size: 18
        }
      },
    },
    scales: {
      x: {
        type: 'linear',
        title: {
          display: true,
          text: 'False Positive Rate',
          font: {
            size: 14
          }
        },
        min: 0,
        max: 1,
      },
      y: {
        type: 'linear',
        title: {
          display: true,
          text: 'True Positive Rate',
          font: {
            size: 14
          }
        },
        min: 0,
        max: 1,
      },
    },
  };

  const renderAUCChart = () => {
    if (!metrics || !metrics.auc_data || metrics.roc_auc === null) {
      return <div>AUC data is not available for this model.</div>;
    }

    const aucChartData = {
      datasets: [
        {
          label: 'ROC Curve',
          data: metrics.auc_data.fpr.map((fpr, index) => ({ x: fpr, y: metrics.auc_data.tpr[index] })),
          borderColor: 'rgb(75, 192, 192)',
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          tension: 0.1,
          fill: false,
        },
        {
          label: 'Random Classifier',
          data: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
          borderColor: 'rgb(192, 75, 75)',
          borderDash: [5, 5],
          pointRadius: 0,
        },
      ],
    };

    return (
      <div style={{ height: '100%', minHeight: '300px', width: '100%' }}>
        <Line options={aucChartOptions} data={aucChartData} />
      </div>
    );
  };

  const renderModelStatus = () => {
    let type: "success" | "error" | "warning" | "info" | "pending" = "info";
    switch(model.status) {
      case 'TRAINING_COMPLETED':
        type = "success";
        break;
      case 'TRAINING_FAILED':
        type = "error";
        break;
      case 'TRAINING':
        type = "pending";
        break;
      case 'SUBMITTED':
        type = "pending";
        break;
      default:
        type = "info";
    }
    return <StatusIndicator type={type}>{model.status}</StatusIndicator>;
  };

  return (
    <SpaceBetween size="l">
      <Header variant="h1">Model Details: {model.name}</Header>
      
      <Container header={<Header variant="h2">Model Information</Header>}>
        <ColumnLayout columns={3} variant="text-grid">
          <div>
            <Header variant="h3">Name</Header>
            <p>{model.name}</p>
          </div>
          <div>
            <Header variant="h3">Description</Header>
            <p>{model.description}</p>
          </div>
          <div>
            <Header variant="h3">Owner</Header>
            <p>{model.owner}</p>
          </div>
          <div>
            <Header variant="h3">Version</Header>
            <p>{model.version}</p>
          </div>
          <div>
            <Header variant="h3">Target Feature</Header>
            <p>{model.targetFeature}</p>
          </div>
          <div>
            <Header variant="h3">Status</Header>
            {renderModelStatus()}
          </div>
        </ColumnLayout>
      </Container>
      
      {model.status === 'TRAINING_COMPLETED' && metrics && (
        <>
          <Container header={<Header variant="h2">Model Performance</Header>}>
            <ColumnLayout columns={2} variant="text-grid">
              <SpaceBetween size="l">
                <div>
                  <Header variant="h3">Key Metrics</Header>
                  <ColumnLayout columns={2} variant="text-grid">
                    <div>
                      <Header variant="h4">Accuracy</Header>
                      <p>{formatNumber(metrics.accuracy)}</p>
                    </div>
                    <div>
                      <Header variant="h4">ROC AUC</Header>
                      <p>{metrics.roc_auc !== null ? formatNumber(metrics.roc_auc) : '-'}</p>
                    </div>
                    <div>
                      <Header variant="h4">CV Score</Header>
                      <p>{formatNumber(metrics.cv_score)}</p>
                    </div>
                  </ColumnLayout>
                </div>
                <div>
                  <Header variant="h3">Confusion Matrix</Header>
                  <Table
                    columnDefinitions={[
                      { id: 'label', header: 'Label', cell: (item) => item.label },
                      { id: 'value', header: 'Value', cell: (item) => item.value },
                    ]}
                    items={[
                      { label: 'True Negatives', value: metrics.confusion_matrix?.true_negatives ?? '-' },
                      { label: 'False Positives', value: metrics.confusion_matrix?.false_positives ?? '-' },
                      { label: 'False Negatives', value: metrics.confusion_matrix?.false_negatives ?? '-' },
                      { label: 'True Positives', value: metrics.confusion_matrix?.true_positives ?? '-' },
                    ]}
                  />
                </div>
              </SpaceBetween>
              <div style={{ height: '400px', width: '100%' }}>
                {metrics.auc_data ? renderAUCChart() : <div>ROC Curve is not available for this model.</div>}
              </div>
            </ColumnLayout>
          </Container>
          
          <Container header={<Header variant="h2">Classification Report</Header>}>
            <Table
              columnDefinitions={[
                { id: 'metric', header: 'Metric', cell: (item) => item.metric },
                { id: 'precision', header: 'Precision', cell: (item) => formatNumber(item.precision) },
                { id: 'recall', header: 'Recall', cell: (item) => formatNumber(item.recall) },
                { id: 'f1_score', header: 'F1 Score', cell: (item) => formatNumber(item.f1_score) },
                { id: 'support', header: 'Support', cell: (item) => item.support },
              ]}
              items={Object.entries(metrics.classification_report || {}).map(([key, value]) => ({
                metric: key,
                precision: value?.precision,
                recall: value?.recall,
                f1_score: value?.f1_score,
                support: value?.support,
              }))}
            />
          </Container>
          
          <Container header={<Header variant="h2">Pipeline Steps</Header>}>
            {pipeline.map((step, index) => (
              <Container key={index} header={<Header variant="h3">{step.step_name}</Header>}>
                <ColumnLayout columns={2} variant="text-grid">
                  <div>
                    <Header variant="h4">Class</Header>
                    <p>{step.class_name}</p>
                  </div>
                  <div>
                    <Header variant="h4">Module</Header>
                    <p>{step.module}</p>
                  </div>
                </ColumnLayout>
                <Header variant="h4">Parameters</Header>
                <pre style={{ maxHeight: '200px', overflowY: 'auto' }}>{JSON.stringify(step.params, null, 2)}</pre>
              </Container>
            ))}
          </Container>
        </>
      )}
    </SpaceBetween>
  );
};

export default ModelDetails;
