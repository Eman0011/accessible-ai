import {
  Alert,
  Box,
  Button,
  ColumnLayout,
  Container,
  ExpandableSection,
  Grid,
  Header,
  Icon,
  Link,
  RadioGroup,
  SpaceBetween,
  Spinner,
  StatusIndicator,
  Table,
  Tabs
} from '@cloudscape-design/components';
import { generateClient } from "aws-amplify/api";
import {
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip
} from 'chart.js';
import React, { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import { useNavigate, useParams } from 'react-router-dom';
import type { Schema } from "../../../../amplify/data/resource";
import { TRAINING_OUTPUT_BUCKET } from '../../../../Config';
import { Model, ModelVersion } from '../../../types/models';
import { getS3JSONFromBucket } from '../../common/utils/S3Utils';
import styles from './ModelDetails.module.css';

// Register ChartJS components
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

// Add these interfaces at the top of the file
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
  total_pipelines?: number;
}

interface PipelineStep {
  step_name: string;
  class_name: string;
  module: string;
  params: { [key: string]: any };
}

const ModelDetails: React.FC = () => {
  const { modelId } = useParams<{ modelId: string }>();
  const navigate = useNavigate();
  const [model, setModel] = useState<Model | null>(null);
  const [versions, setVersions] = useState<ModelVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('details');
  const [modelOutputData, setModelOutputData] = useState<any>(null);
  const [metrics, setMetrics] = useState<ModelMetrics | null>(null);
  const [pipeline, setPipeline] = useState<PipelineStep[]>([]);
  const [showPipelineInfo, setShowPipelineInfo] = useState(true);
  const [showEnterpriseAlert, setShowEnterpriseAlert] = useState(true);

  useEffect(() => {
    if (modelId) {
      fetchModelDetails();
    }
  }, [modelId]);

  const getModelOutput = async (key: string) => {
    return await getS3JSONFromBucket<any>(key, TRAINING_OUTPUT_BUCKET);
  };

  const fetchModelOutputData = async (version: ModelVersion) => {
    try {
      console.log('Model Version Data:', {
        version,
        modelUrl: version.modelUrl || '',
        s3OutputPath: version.s3OutputPath || '',
        fileUrl: version.fileUrl || ''
      });

      let basePath = version.s3OutputPath;

      if (!basePath) {
        console.error('No valid S3 path found in version:', version);
        return;
      }

      // Construct the full paths
      const metricsPath = `${basePath}/best_model_metrics.json`;
      const pipelinePath = `${basePath}/best_model_pipeline.json`;
      
      console.log('Attempting to fetch from paths:', {
        metricsPath,
        pipelinePath,
        bucket: TRAINING_OUTPUT_BUCKET
      });

      // Fetch both files using the S3 client
      const [metricsData, pipelineData] = await Promise.all([
        getModelOutput(metricsPath),
        getModelOutput(pipelinePath)
      ]);
      
      console.log('Successfully fetched model output data:', {
        metrics: metricsData,
        pipeline: pipelineData
      });

      setMetrics(metricsData);
      setPipeline(pipelineData);
      setModelOutputData({
        metrics: metricsData,
        pipeline: pipelineData
      });
    } catch (error) {
      console.error('Error fetching model output data:', error);
    }
  };

  const fetchModelDetails = async () => {
    try {
      setLoading(true);
      const { data: fetchedModel } = await client.models.Model.get({ id: modelId });
      const { data: fetchedVersions } = await client.models.ModelVersion.list({
        filter: { modelId: { eq: modelId } }
      });

      console.log('Fetched Model Data:', {
        model: fetchedModel,
        versions: fetchedVersions
      });

      if (!fetchedModel) {
        throw new Error('Model not found');
      }

      const modelData: Model = {
        id: fetchedModel.id || '',
        name: fetchedModel.name || '',
        description: fetchedModel.description || '',
        owner: fetchedModel.owner || '',
        projectId: fetchedModel.projectId || '',
        createdAt: fetchedModel.createdAt || null,
        updatedAt: fetchedModel.updatedAt || null
      };

      const versionData: ModelVersion[] = (fetchedVersions || []).map(v => ({
        id: v.id || '',
        modelId: v.modelId || '',
        version: v.version || 0,
        status: v.status as ModelStatus || 'DRAFT',
        targetFeature: v.targetFeature || '',
        fileUrl: v.fileUrl || '',
        modelUrl: v.modelUrl || '',
        trainingJobId: v.trainingJobId || '',
        performanceMetrics: {},
        createdAt: v.createdAt || null,
        updatedAt: v.updatedAt || null,
        datasetVersionId: v.datasetVersionId || ''
      }));

      console.log('Processed Model Data:', {
        modelData,
        versionData
      });

      const sortedVersions = versionData.sort((a, b) => b.version - a.version);
      setModel(modelData);
      setVersions(sortedVersions);
      
      if (sortedVersions.length > 0) {
        setSelectedVersion(sortedVersions[0].id);
      }
    } catch (error) {
      console.error('Error fetching model details:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'TRAINING_COMPLETED':
        return 'success';
      case 'TRAINING_FAILED':
        return 'error';
      case 'TRAINING':
        return 'in-progress';
      case 'DRAFT':
        return 'pending';
      default:
        return 'info';
    }
  };

  useEffect(() => {
    const selectedModelVersion = versions.find(v => v.id === selectedVersion);
    if (selectedModelVersion?.status === 'TRAINING_COMPLETED') {
      fetchModelOutputData(selectedModelVersion);
    }
  }, [selectedVersion, versions]);

  const renderOverviewAndVersions = () => (
    <Grid
      gridDefinition={[
        { colspan: 4 },
        { colspan: 8 }
      ]}
    >
      <Container header={<Header variant="h2">Model Versions</Header>}>
        <div className={styles.versionsContainer}>
          <RadioGroup
            onChange={({ detail }) => setSelectedVersion(detail.value)}
            value={selectedVersion || ''}
            items={versions.map(version => ({
              value: version.id,
              label: `Version ${version.version}`,
              description: (
                <SpaceBetween size="xs" direction="horizontal">
                  <StatusIndicator type={getStatusColor(version.status)}>{version.status}</StatusIndicator>
                  <span>{new Date(version.createdAt || '').toLocaleDateString()}</span>
                  {version.targetFeature && <span>Target: {version.targetFeature}</span>}
                </SpaceBetween>
              )
            }))}
          />
        </div>
      </Container>

      <div className={styles.overviewDetailsContainer}>
        <SpaceBetween size="l">
          <Container header={<Header variant="h2">Model Overview</Header>}>
            <ColumnLayout columns={2}>
              <div>
                <Box variant="awsui-key-label">Name</Box>
                <div>{model?.name}</div>
              </div>
              <div>
                <Box variant="awsui-key-label">Owner</Box>
                <div>{model?.owner}</div>
              </div>
              <div>
                <Box variant="awsui-key-label">Description</Box>
                <div>{model?.description}</div>
              </div>
              <div>
                <Box variant="awsui-key-label">Created</Box>
                <div>{new Date(model?.createdAt || '').toLocaleString()}</div>
              </div>
            </ColumnLayout>
          </Container>

          {selectedVersion && (
            <Container header={<Header variant="h2">Version Details</Header>}>
              <ColumnLayout columns={2}>
                <div>
                  <Box variant="awsui-key-label">Status</Box>
                  <StatusIndicator type={getStatusColor(versions.find(v => v.id === selectedVersion)!.status)}>
                    {versions.find(v => v.id === selectedVersion)!.status}
                  </StatusIndicator>
                </div>
                <div>
                  <Box variant="awsui-key-label">Target Feature</Box>
                  <div>{versions.find(v => v.id === selectedVersion)!.targetFeature || '-'}</div>
                </div>
                <div>
                  <Box variant="awsui-key-label">Dataset Version</Box>
                  <div>{versions.find(v => v.id === selectedVersion)!.datasetVersionId || '-'}</div>
                </div>
                <div>
                  <Box variant="awsui-key-label">Training Job ID</Box>
                  <div>{versions.find(v => v.id === selectedVersion)!.trainingJobId || '-'}</div>
                </div>
              </ColumnLayout>
            </Container>
          )}
        </SpaceBetween>
      </div>
    </Grid>
  );

  const renderVersionDetailsAndPipeline = (version: ModelVersion) => (
    pipeline && pipeline.length > 0 && (
      <div className={styles.pipelineGridContainer}>
        <Grid
          gridDefinition={[
            { colspan: 8 },  // Pipeline section
            { colspan: 4 }   // EDA Analysis section
          ]}
        >
          <Container 
            header={
              <Header
                variant="h2"
                counter={`Winner of ${metrics?.total_pipelines || 100}+ evaluated pipelines`}
                description="This pipeline achieved the highest cross-validated score during genetic optimization"
              >
                Model Pipeline
              </Header>
            }
          >
            <SpaceBetween size="l">
              <ExpandableSection
                headerText="View Alternative Pipelines"
                variant="footer"
              >
                <Box color="text-status-inactive">
                  Advanced feature: Compare and promote alternative pipelines from the genetic optimization process.
                  Available with Enterprise subscription.
                </Box>
              </ExpandableSection>

              <div className={styles.pipelineContainer}>
                {pipeline.map((step, index) => (
                  <React.Fragment key={index}>
                    <div className={styles.stepContainer}>
                      <SpaceBetween size="s">
                        <div className={styles.stepIcon}>
                          <Icon name="settings" size="big" />
                        </div>
                        <div className={styles.className}>
                          <Box variant="h3">{step.class_name}</Box>
                          <div className={styles.module}>{step.module}</div>
                        </div>
                        <ExpandableSection headerText="Parameters">
                          <pre className={styles.params}>
                            {JSON.stringify(step.params, null, 2)}
                          </pre>
                        </ExpandableSection>
                      </SpaceBetween>
                    </div>
                    {index < pipeline.length - 1 && (
                      <div className={styles.arrow}>
                        <Icon name="angle-right" size="big" />
                      </div>
                    )}
                  </React.Fragment>
                ))}
              </div>

              {showPipelineInfo && (
                <Alert
                  type="info"
                  dismissible={true}
                  onDismiss={() => setShowPipelineInfo(false)}
                >
                  This pipeline was selected through genetic programming optimization, evaluating multiple generations 
                  of pipeline configurations to find the most effective combination of preprocessing and modeling steps.
                </Alert>
              )}
            </SpaceBetween>
          </Container>

          <Container
            header={
              <Header
                variant="h2"
                info={<Link>Learn more about EDA's analysis</Link>}
              >
                EDA's Model Analysis
              </Header>
            }
          >
            <div className={styles.edaAnalysisContainer}>
              <div className={styles.edaContent}>
                <SpaceBetween size="l">
                  <Box variant="awsui-key-label">Pipeline Summary</Box>
                  <Box color="text-status-inactive">
                    Coming soon: AI-powered analysis of your model pipeline, explaining each step in plain English 
                    and providing insights about the model's approach to solving your problem.
                  </Box>

                  <Box variant="awsui-key-label">Performance Insights</Box>
                  <Box color="text-status-inactive">
                    Coming soon: Natural language explanations of your model's performance metrics, 
                    highlighting strengths and potential areas for improvement.
                  </Box>
                </SpaceBetween>
              </div>

              <div className={styles.edaAlertContainer}>
                {showEnterpriseAlert && (
                  <Alert
                    type="info"
                    header="Enterprise Feature"
                    dismissible={true}
                    onDismiss={() => setShowEnterpriseAlert(false)}
                  >
                    Get detailed AI-powered analysis of your models with our Enterprise plan. 
                    Our assistant EDA will help you understand complex ML concepts and make better decisions.
                  </Alert>
                )}
              </div>
            </div>
          </Container>
        </Grid>
      </div>
    )
  );

  const renderPerformanceSection = (version: ModelVersion) => (
    metrics && version.status === 'TRAINING_COMPLETED' && (
      <Container header={<Header variant="h2">Model Performance</Header>}>
        <SpaceBetween size="l">
          {/* Performance Summary */}
          <ColumnLayout columns={3}>
            <div>
              <Box variant="awsui-key-label">Accuracy</Box>
              <div>{metrics.accuracy?.toFixed(4) || '-'}</div>
            </div>
            <div>
              <Box variant="awsui-key-label">ROC AUC</Box>
              <div>{metrics.roc_auc?.toFixed(4) || '-'}</div>
            </div>
            <div>
              <Box variant="awsui-key-label">CV Score</Box>
              <div>{metrics.cv_score?.toFixed(4) || '-'}</div>
            </div>
          </ColumnLayout>

          <ColumnLayout columns={2}>
            <div className={styles.tablesContainer}>
              {/* Confusion Matrix */}
              {metrics.confusion_matrix && (
                <div>
                  <Header variant="h3">Confusion Matrix</Header>
                  <Table
                    columnDefinitions={[
                      { id: 'label', header: 'Label', cell: (item) => item.label },
                      { id: 'value', header: 'Value', cell: (item) => item.value },
                    ]}
                    items={[
                      { label: 'True Negatives', value: metrics.confusion_matrix.true_negatives },
                      { label: 'False Positives', value: metrics.confusion_matrix.false_positives },
                      { label: 'False Negatives', value: metrics.confusion_matrix.false_negatives },
                      { label: 'True Positives', value: metrics.confusion_matrix.true_positives },
                    ]}
                  />
                </div>
              )}

              {/* Classification Report */}
              {metrics.classification_report && (
                <div>
                  <Header variant="h3">Classification Report</Header>
                  <Table
                    columnDefinitions={[
                      { id: 'metric', header: 'Class', cell: (item) => item.metric },
                      { id: 'precision', header: 'Precision', cell: (item) => item.precision?.toFixed(4) || '-' },
                      { id: 'recall', header: 'Recall', cell: (item) => item.recall?.toFixed(4) || '-' },
                      { id: 'f1_score', header: 'F1 Score', cell: (item) => item.f1_score?.toFixed(4) || '-' },
                      { id: 'support', header: 'Support', cell: (item) => item.support || '-' },
                    ]}
                    items={Object.entries(metrics.classification_report).map(([key, value]) => ({
                      metric: key,
                      ...value
                    }))}
                  />
                </div>
              )}
            </div>

            {/* AUC Chart */}
            <div className={styles.chartContainer}>
              {metrics.auc_data && renderAUCChart()}
            </div>
          </ColumnLayout>
        </SpaceBetween>
      </Container>
    )
  );

  const handleCreateNewVersion = () => {
    navigate('/models/create', { state: { selectedModelId: modelId } });
  };

  const renderAUCChart = () => {
    if (!metrics?.auc_data) return null;

    const data = {
      datasets: [
        {
          label: 'ROC Curve',
          data: metrics.auc_data.fpr.map((fpr, index) => ({ 
            x: fpr, 
            y: metrics.auc_data.tpr[index] 
          })),
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

    const options = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top' as const,
        },
        title: {
          display: true,
          text: 'ROC Curve',
          font: { size: 18 }
        },
      },
      scales: {
        x: {
          type: 'linear' as const,
          title: {
            display: true,
            text: 'False Positive Rate',
            font: { size: 14 }
          },
          min: 0,
          max: 1,
        },
        y: {
          type: 'linear' as const,
          title: {
            display: true,
            text: 'True Positive Rate',
            font: { size: 14 }
          },
          min: 0,
          max: 1,
        },
      },
    };

    return <Line data={data} options={options} />;
  };

  if (loading) {
    return <Spinner size="large" />;
  }

  if (!model) {
    return <Box>Model not found</Box>;
  }

  return (
    <SpaceBetween size="l">
      <Header
        variant="h1"
        actions={
          <Button variant="primary" onClick={handleCreateNewVersion}>
            Create New Version
          </Button>
        }
      >
        {model.name}
      </Header>

      <Tabs
        activeTabId={activeTab}
        onChange={({ detail }) => setActiveTab(detail.activeTabId)}
        tabs={[
          {
            id: 'details',
            label: 'Details',
            content: (
              <SpaceBetween size="l">
                {renderOverviewAndVersions()}
                {selectedVersion && (
                  <>
                    {renderVersionDetailsAndPipeline(versions.find(v => v.id === selectedVersion)!)}
                    {renderPerformanceSection(versions.find(v => v.id === selectedVersion)!)}
                  </>
                )}
              </SpaceBetween>
            )
          },
          {
            id: 'monitoring',
            label: 'Monitoring',
            content: (
              <Container>
                <p>Model monitoring content coming soon...</p>
              </Container>
            )
          }
        ]}
      />
    </SpaceBetween>
  );
};

export default ModelDetails;
