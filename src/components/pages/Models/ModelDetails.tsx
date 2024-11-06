import {
  Alert,
  Box,
  Button,
  ColumnLayout,
  Container,
  ExpandableSection,
  Header,
  Icon,
  Link,
  Select,
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
import { Model, ModelStatus, ModelVersion } from '../../../types/models';
import { getPipelineStepIcon, hasCustomIcon } from '../../../utils/PipelineIconUtils';
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

// Move getStatusColor before VersionCard
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
      return 'pending';
  }
};

// First, let's create a version card component
const VersionCard: React.FC<{
  version: ModelVersion;
  isSelected: boolean;
  onClick: () => void;
}> = ({ version, isSelected, onClick }) => (
  <div 
    className={`${styles.versionCard} ${isSelected ? styles.selectedVersion : ''}`}
    onClick={onClick}
  >
    <SpaceBetween size="s">
      <div className={styles.versionHeader}>
        <span className={styles.versionNumber}>Version {version.version}</span>
        <StatusIndicator type={getStatusColor(version.status)}>{version.status}</StatusIndicator>
      </div>
      <div className={styles.versionDetails}>
        <div>Target: {version.targetFeature || '-'}</div>
        <div>Dataset: {version.datasetVersionId || '-'}</div>
        <div>Created: {new Date(version.createdAt || '').toLocaleDateString()}</div>
      </div>
    </SpaceBetween>
  </div>
);

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
  let count = 0;

  const fetchData = async () => {
    if (modelId) {
      try {
        setLoading(true);
        const { data: fetchedModel } = await client.models.Model.get({ id: modelId });
        const { data: fetchedVersions } = await client.models.ModelVersion.list({
          filter: { modelId: { eq: modelId } }
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

        const versionData: ModelVersion[] = (fetchedVersions || [])
          .map(v => ({
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
          }))
          .sort((a, b) => b.version - a.version);

        setModel(modelData);
        setVersions(versionData);
        
        if (versionData.length > 0) {
          setSelectedVersion(versionData[0].id);
        }
      } catch (error) {
        console.error('Error fetching model details:', error);
      } finally {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    let mounted = true;

    const initData = async () => {
      if (mounted) {
        await fetchData();
      }
    };

    initData();
    return () => {
      mounted = false;
    };
  }, [modelId]);

  const fetchModelOutputData = async (version: ModelVersion) => {
    try {
      let basePath = version.s3OutputPath;

      if (!basePath) {
        console.error('No valid S3 path found in version:', version);
        return;
      }

      // Ensure basePath starts with bucket name
      if (!basePath.startsWith(TRAINING_OUTPUT_BUCKET)) {
        basePath = `${TRAINING_OUTPUT_BUCKET}/${basePath}`;
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

  useEffect(() => {
    const selectedModelVersion = versions.find(v => v.id === selectedVersion);
    if (selectedModelVersion?.status === 'TRAINING_COMPLETED' && selectedVersion) {
      setMetrics(null);
      setPipeline([]);
      setModelOutputData(null);
      
      // Wrap in async IIFE
      (async () => {
        try {
          await fetchModelOutputData(selectedModelVersion);
        } catch (error) {
          console.error('Error fetching model output data:', error);
        }
      })();
    }
  }, [selectedVersion]);

  const renderOverviewAndVersions = () => (
    <div className={styles.mainContentGrid}>
      {/* Left column: Versions and EDA */}
      <div className={styles.leftColumn}>
        {/* Version selector */}
        <Container header={<Header variant="h2">Model Version</Header>}>
          <SpaceBetween size="m">
            <Select
              selectedOption={selectedVersion ? {
                label: `Version ${versions.find(v => v.id === selectedVersion)?.version}`,
                value: selectedVersion
              } : null}
              onChange={({ detail }) => setSelectedVersion(detail.selectedOption?.value || null)}
              options={versions.map(version => ({
                label: `Version ${version.version} (${version.status})`,
                value: version.id,
                description: `Created: ${new Date(version.createdAt || '').toLocaleDateString()}`
              }))}
            />
            
            {/* Version Details moved into ExpandableSection */}
            {selectedVersion && (
              <ExpandableSection 
                headerText="Version Details" 
                variant="default"
                defaultExpanded={
                  // Expand by default if version is not completed
                  versions.find(v => v.id === selectedVersion)?.status !== 'TRAINING_COMPLETED'
                }
              >
                <div className={styles.versionDetailsCard}>
                  <SpaceBetween size="s">
                    <StatusIndicator type={getStatusColor(versions.find(v => v.id === selectedVersion)?.status || 'DRAFT')}>
                      {versions.find(v => v.id === selectedVersion)?.status || 'DRAFT'}
                    </StatusIndicator>
                    <ColumnLayout columns={2}>
                      <div>
                        <Box variant="awsui-key-label">Target Feature</Box>
                        <div>{versions.find(v => v.id === selectedVersion)?.targetFeature || '-'}</div>
                      </div>
                      <div>
                        <Box variant="awsui-key-label">Dataset Version</Box>
                        <div>{versions.find(v => v.id === selectedVersion)?.datasetVersionId || '-'}</div>
                      </div>
                      <div>
                        <Box variant="awsui-key-label">Created</Box>
                        <div>{new Date(versions.find(v => v.id === selectedVersion)?.createdAt || '').toLocaleString()}</div>
                      </div>
                      <div>
                        <Box variant="awsui-key-label">Training Job</Box>
                        <div>{versions.find(v => v.id === selectedVersion)?.trainingJobId || '-'}</div>
                      </div>
                    </ColumnLayout>
                  </SpaceBetween>
                </div>
              </ExpandableSection>
            )}
          </SpaceBetween>
        </Container>

        {/* EDA Analysis */}
        {selectedVersion && versions.find(v => v.id === selectedVersion)?.status === 'TRAINING_COMPLETED' && (
          <Container
            header={
              <Header
                variant="h2"
                info={<Link>Learn more about EDA's analysis</Link>}
              >
                EDA's Model Analysis
              </Header>
            }
            className={styles.edaContainer}
          >
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
          </Container>
        )}
      </div>

      {/* Right column: Pipeline and Performance */}
      <div className={styles.rightColumn}>
        {selectedVersion && renderVersionDetailsAndPipeline(versions.find(v => v.id === selectedVersion)!)}
        {selectedVersion && versions.find(v => v.id === selectedVersion)?.status === 'TRAINING_COMPLETED' && 
          renderPerformanceSection(versions.find(v => v.id === selectedVersion)!)
        }
      </div>
    </div>
  );

  const renderVersionDetailsAndPipeline = (version: ModelVersion) => (
    version.status === 'TRAINING_COMPLETED' && (
      <Container 
        header={
          <Header variant="h2">Model Pipeline</Header>
        }
      >
        {pipelineError ? (
          <Alert type="error">{pipelineError}</Alert>
        ) : pipeline && pipeline.length > 0 ? (
          <>
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

              
              <div className={styles.pipelineHeader}>
               <div className={styles.topPipelineBadge}>
                <img 
                  src={getPipelineStepIcon({ class_name: 'TopPipeline' })} 
                  alt="Top Pipeline"
                  className={styles.topPipelineIcon}
                />
                <div>Top Pipeline</div>
               </div>
                <Box color="text-status-success" textAlign="center" padding={{ top: 'l' }}>
                  <div>
                    <span>
                      <Icon 
                        name="status-positive" 
                        size="small" 
                        variant="success"
                      />
                    </span>
                    <span> Highest peforming pipeline out of 1,000 candidates <br /> through genetic programming optimization.</span>
                  </div>
                </Box>
              </div>
          </>
        ) : (
          <Spinner size="large" />
        )}

        <ExpandableSection
          headerText="View Alternative Pipelines (999 more)"
          variant="footer"
          className={styles.alternativePipelines}
        >
          <Alert
            type="info"
            header="Coming Soon"
            dismissible={false}
          >
            You'll soon be able to explore and compare all the pipeline variations that were evaluated 
            during training. This will help you understand the model selection process and why this 
            pipeline was chosen as the best performer.
          </Alert>
        </ExpandableSection>
      </Container>
    )
  );

  const renderPerformanceSection = (version: ModelVersion) => (
    version.status === 'TRAINING_COMPLETED' && (
      <Container header={<Header variant="h2">Model Performance</Header>}>
        <div className={styles.performanceContainer}>
          {metricsError ? (
            <Alert type="error">{metricsError}</Alert>
          ) : metrics ? (
            <SpaceBetween size="l">
              {/* ROC Curve Chart */}
              <div className={styles.chartContainer}>
                <Header variant="h3">ROC Curve</Header>
                {metrics.auc_data ? (
                  renderAUCChart()
                ) : (
                  <Box color="text-status-inactive">ROC curve not available</Box>
                )}
              </div>

              {/* Performance Summary */}
              <div className={styles.metricsGrid}>
                <div className={styles.metricContainer}>
                  <Box variant="awsui-key-label">Accuracy</Box>
                  <div>{metrics.accuracy?.toFixed(4) || '-'}</div>
                </div>
                <div className={styles.metricContainer}>
                  <Box variant="awsui-key-label">CV Score</Box>
                  <div>{metrics.cv_score?.toFixed(4) || '-'}</div>
                </div>
                <div className={styles.metricContainer}>
                  <Box variant="awsui-key-label">ROC AUC</Box>
                  <div>{metrics.roc_auc?.toFixed(4) || 'N/A'}</div>
                </div>
              </div>

              {/* Metrics Tables */}
              <div className={styles.metricsTablesColumn}>
                {/* Confusion Matrix */}
                <div className={styles.metricContainer}>
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
                    <Box color="text-status-inactive">Confusion matrix not available</Box>
                  )}
                </div>

                {/* Classification Report */}
                <div className={styles.metricContainer}>
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
                    <Box color="text-status-inactive">Classification report not available</Box>
                  )}
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
          display: false, // Remove title since we have the Header component
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

    return (
      <div style={{ width: '100%', height: '400px' }}> {/* Fixed height for better space utilization */}
        <Line data={data} options={options} />
      </div>
    );
  };

  if (loading) {
    return <Spinner size="large" />;
  }

  if (!model) {
    return <Box>Model not found</Box>;
  }

  return (
    <SpaceBetween size="l">
      {/* Title and actions */}
      <Header
        variant="h1"
        actions={
          <SpaceBetween direction="horizontal" size="xs">
            <Button onClick={fetchData} iconName="refresh">
              Refresh
            </Button>
            <Button variant="primary" onClick={handleCreateNewVersion}>
              Create New Version
            </Button>
          </SpaceBetween>
        }
      >
        {model.name}
      </Header>

      {/* Model Overview */}
      <div className={styles.modelOverview}>
        <ColumnLayout columns={8}>
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
          <div>
            <Box variant="awsui-key-label">Status</Box>
            <StatusIndicator type={getStatusColor(versions[0]?.status || 'DRAFT')}>
              {versions[0]?.status || 'DRAFT'}
            </StatusIndicator>
          </div>
        </ColumnLayout>
      </div>

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
