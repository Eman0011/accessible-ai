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
import updateModelVersionStatus from '../../../../update_model_status';
import { Model, ModelStatus, ModelVersion } from '../../../types/models';
import { globalS3Cache } from '../../../utils/CacheUtils';
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
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [pipelineError, setPipelineError] = useState<string | null>(null);
  let count = 1;

  useEffect(() => {
    if (modelId) {
      fetchModelDetails();
      if (count == 0) {
        updateModelVersionStatus(9)
        count++;
      }
    }
  }, [modelId]);

  const fetchModelOutputData = async (version: ModelVersion) => {
    try {
      let basePath = version.s3OutputPath;

      if (!basePath) {
        console.error('No valid S3 path found in version:', version);
        return;
      }

      const metricsPath = `${basePath}/best_model_metrics.json`;
      const pipelinePath = `${basePath}/best_model_pipeline.json`;
      
      // Reset error states
      setMetricsError(null);
      setPipelineError(null);

      // Fetch metrics and pipeline separately to handle partial failures
      try {
        const metricsData = await getS3JSONFromBucket<ModelMetrics>(metricsPath, TRAINING_OUTPUT_BUCKET);
        setMetrics(metricsData);
      } catch (metricsError) {
        console.error('Error fetching metrics:', metricsError);
        setMetricsError('Failed to load model metrics');
        setMetrics(null);
      }

      try {
        const pipelineData = await getS3JSONFromBucket<PipelineStep[]>(pipelinePath, TRAINING_OUTPUT_BUCKET);
        setPipeline(pipelineData);
      } catch (pipelineError) {
        console.error('Error fetching pipeline:', pipelineError);
        setPipelineError('Failed to load model pipeline');
        setPipeline([]);
      }

    } catch (error) {
      console.error('Error in fetchModelOutputData:', error);
      setMetricsError('Failed to load model data');
      setPipelineError('Failed to load model data');
      setMetrics(null);
      setPipeline([]);
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
        s3OutputPath: v.s3OutputPath || '',
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
      // Clear existing metrics and pipeline data
      setMetrics(null);
      setPipeline([]);
      setModelOutputData(null);
      
      // Clear cache for the previous version's data if it exists
      if (selectedModelVersion.s3OutputPath) {
        const metricsPath = `${selectedModelVersion.s3OutputPath}/best_model_metrics.json`;
        const pipelinePath = `${selectedModelVersion.s3OutputPath}/best_model_pipeline.json`;
        const metricsCacheKey = `${TRAINING_OUTPUT_BUCKET}/${metricsPath}`;
        const pipelineCacheKey = `${TRAINING_OUTPUT_BUCKET}/${pipelinePath}`;
        globalS3Cache.clear(); // Clear entire cache when switching versions
      }
      
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
    version.status === 'TRAINING_COMPLETED' && (
      <div className={styles.pipelineGridContainer}>
        <Grid
          gridDefinition={[
            { colspan: 8 },
            { colspan: 4 }
          ]}
        >
          <Container 
            header={
              <Header variant="h2">
                Model Pipeline
              </Header>
            }
          >
            {pipelineError ? (
              <Alert type="error">
                {pipelineError}
              </Alert>
            ) : pipeline && pipeline.length > 0 ? (
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
            ) : (
              <Spinner size="large" />
            )}
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
    version.status === 'TRAINING_COMPLETED' && (
      <Container header={<Header variant="h2">Model Performance</Header>}>
        <div className={styles.performanceContainer}>
          {metricsError ? (
            <Alert type="error">
              {metricsError}
            </Alert>
          ) : metrics ? (
            <SpaceBetween size="l">
              {/* Performance Summary */}
              <ColumnLayout columns={3}>
                <div>
                  <Box variant="awsui-key-label">Accuracy</Box>
                  <div>{metrics.accuracy?.toFixed(4) || '-'}</div>
                </div>
                <div>
                  <Box variant="awsui-key-label">CV Score</Box>
                  <div>{metrics.cv_score?.toFixed(4) || '-'}</div>
                </div>
                <div>
                  <Box variant="awsui-key-label">ROC AUC</Box>
                  <div>{metrics.roc_auc?.toFixed(4) || 'N/A'}</div>
                </div>
              </ColumnLayout>

              <div className={styles.metricsGrid}>
                <div className={styles.metricsColumn}>
                  {/* Confusion Matrix */}
                  <div>
                    <Header variant="h3">Confusion Matrix</Header>
                    {metrics.confusion_matrix ? (
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
                    ) : (
                      <Box color="text-status-inactive">Confusion matrix not available for this model</Box>
                    )}
                  </div>

                  {/* Classification Report */}
                  <div>
                    <Header variant="h3">Classification Report</Header>
                    {metrics.classification_report ? (
                      <Table
                        columnDefinitions={[
                          { id: 'metric', header: 'Class', cell: (item) => (
                            <div style={{ 
                              fontWeight: item.isAggregate ? 'bold' : 'normal',
                              borderTop: item.isAggregate ? '1px solid #e9ebed' : 'none',
                              paddingTop: item.isAggregate ? '8px' : '0'
                            }}>
                              {item.metric}
                            </div>
                          )},
                          { 
                            id: 'precision', 
                            header: 'Precision', 
                            cell: (item) => (
                              <div style={{ 
                                fontWeight: item.isAggregate ? 'bold' : 'normal',
                                borderTop: item.isAggregate ? '1px solid #e9ebed' : 'none',
                                paddingTop: item.isAggregate ? '8px' : '0'
                              }}>
                                {item.precision?.toFixed(4) || '-'}
                              </div>
                            )
                          },
                          { 
                            id: 'recall', 
                            header: 'Recall', 
                            cell: (item) => (
                              <div style={{ 
                                fontWeight: item.isAggregate ? 'bold' : 'normal',
                                borderTop: item.isAggregate ? '1px solid #e9ebed' : 'none',
                                paddingTop: item.isAggregate ? '8px' : '0'
                              }}>
                                {item.recall?.toFixed(4) || '-'}
                              </div>
                            )
                          },
                          { 
                            id: 'f1_score', 
                            header: 'F1 Score', 
                            cell: (item) => (
                              <div style={{ 
                                fontWeight: item.isAggregate ? 'bold' : 'normal',
                                borderTop: item.isAggregate ? '1px solid #e9ebed' : 'none',
                                paddingTop: item.isAggregate ? '8px' : '0'
                              }}>
                                {item.f1_score?.toFixed(4) || '-'}
                              </div>
                            )
                          },
                          { 
                            id: 'support', 
                            header: 'Support', 
                            cell: (item) => (
                              <div style={{ 
                                fontWeight: item.isAggregate ? 'bold' : 'normal',
                                borderTop: item.isAggregate ? '1px solid #e9ebed' : 'none',
                                paddingTop: item.isAggregate ? '8px' : '0'
                              }}>
                                {item.support || '-'}
                              </div>
                            )
                          },
                        ]}
                        items={[
                          // Regular class metrics
                          ...Object.entries(metrics.classification_report)
                            .filter(([key]) => !['accuracy', 'macro avg', 'weighted avg'].includes(key))
                            .map(([key, value]) => ({
                              metric: key,
                              ...value,
                              isAggregate: false
                            })),
                          // Aggregate metrics
                          ...['macro avg', 'weighted avg'].map(key => ({
                            metric: key,
                            ...metrics.classification_report[key],
                            isAggregate: true
                          }))
                        ]}
                      />
                    ) : (
                      <Box color="text-status-inactive">Classification report not available for this model</Box>
                    )}
                  </div>
                </div>

                {/* AUC Chart */}
                <div className={styles.chartContainer}>
                  <Header variant="h3">ROC Curve</Header>
                  <div className={styles.chartContent}>
                    {metrics.auc_data ? (
                      renderAUCChart()
                    ) : (
                      <Box color="text-status-inactive">ROC curve not available for this model</Box>
                    )}
                  </div>
                </div>
              </div>
            </SpaceBetween>
          ) : (
            <Spinner size="large" />
          )}
        </div>
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
