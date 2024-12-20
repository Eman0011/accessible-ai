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
import TopPipelineIcon from '../../../assets/aai_icons/pipeline_steps/TopPipeline.webp';
import { Model, ModelMetrics, ModelStatus, ModelVersion, PipelineStep } from '../../../types/models';
import ModelPipelineVisualizer from '../../common/ModelPipelineVisualizer/ModelPipelineVisualizer';
import { getS3JSONFromBucket } from '../../common/utils/S3Utils';
import { VersionSelector } from './components/VersionSelector';
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

const ModelDetails: React.FC = () => {
  const { modelId } = useParams<{ modelId: string }>();
  const navigate = useNavigate();
  const [model, setModel] = useState<Model | null>(null);
  const [versions, setVersions] = useState<ModelVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<ModelVersion | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('details');
  const [modelOutputData, setModelOutputData] = useState<any>(null);
  const [metrics, setMetrics] = useState<ModelMetrics | null>(null);
  const [pipeline, setPipeline] = useState<PipelineStep[]>([]);
  const [showEnterpriseAlert, setShowEnterpriseAlert] = useState(true);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [pipelineError, setPipelineError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [datasetVersionDetails, setDatasetVersionDetails] = useState<{ 
    datasetId: string, 
    version: number,
    datasetName: string 
  } | null>(null);
  const [showingAlternativePipeline, setShowingAlternativePipeline] = useState(false);

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
          setSelectedVersion(versionData[0]);
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

      // Reset error states
      setMetricsError(null);
      setPipelineError(null);

      // Fetch metrics and pipeline separately to handle partial failures
      try {
        const metricsData = await getS3JSONFromBucket<ModelMetrics>(
          `${basePath}/best_model_metrics.json`
        );
        setMetrics(metricsData);
      } catch (metricsError) {
        console.error('Error fetching metrics:', metricsError);
        setMetricsError('Failed to load model metrics');
        setMetrics(null);
      }

      try {
        const pipelineData = await getS3JSONFromBucket<PipelineStep[]>(
          `${basePath}/best_model_pipeline.json`
        );
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
    if (selectedVersion && selectedVersion?.status === "TRAINING_COMPLETED") {
      setMetrics(null);
      setPipeline([]);
      setModelOutputData(null);
      
      // Wrap in async IIFE
      (async () => {
        try {
          await fetchModelOutputData(selectedVersion);
        } catch (error) {
          console.error('Error fetching model output data:', error);
        }
      })();
    }
  }, [selectedVersion]);

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

              {/* Metrics Tables - Reordered */}
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
              </div>

              {/* Classification Report moved below Confusion Matrix */}
              <div className={styles.metricsTablesColumn}>
                <div className={styles.metricContainer}>
                  <Header variant="h3">Classification Report</Header>
                  {metrics.classification_report ? (
                    <Table
                      columnDefinitions={[
                        { 
                          id: 'metric', 
                          header: 'Class', 
                          cell: (item) => (
                            <div style={{ 
                              fontWeight: item.isAggregate ? 'bold' : 'normal',
                              borderTop: item.isAggregate ? '1px solid #e9ebed' : 'none',
                              paddingTop: item.isAggregate ? '8px' : '0'
                            }}>
                              {item.metric}
                            </div>
                          )
                        },
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
                          id: 'f1-score', 
                          header: 'F1 Score', 
                          cell: (item) => (
                            <div style={{ 
                              fontWeight: item.isAggregate ? 'bold' : 'normal',
                              borderTop: item.isAggregate ? '1px solid #e9ebed' : 'none',
                              paddingTop: item.isAggregate ? '8px' : '0'
                            }}>
                              {item['f1-score']?.toFixed(4) || '-'}
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

  const handleRunPredictions = () => {
    if (model && selectedVersion) {
      navigate('/models/predictions', { 
        state: { 
          selectedModelId: model.id,
          selectedModelVersionId: selectedVersion.id  // Pass the selected version ID
        }
      });
    }
  };

  const handleRefresh = () => {
    fetchData();  // Re-fetch all model data
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

  const handleVersionSelect = async (version: ModelVersion | null) => {
    if (version) {
      setSelectedVersion(version);
    }
  };

  const getDatasetDetails = async (datasetVersionId: string) => {
    try {
      const { data: datasetVersion } = await client.models.DatasetVersion.get({ id: datasetVersionId });
      if (datasetVersion) {
        // Fetch the dataset to get its name
        const { data: dataset } = await client.models.Dataset.get({ id: datasetVersion.datasetId });
        
        setDatasetVersionDetails({
          datasetId: datasetVersion.datasetId,
          version: datasetVersion.version,
          datasetName: dataset?.name || 'Unknown Dataset'
        });
        return {
          datasetId: datasetVersion.datasetId,
          version: datasetVersion.version,
          datasetName: dataset?.name
        };
      }
    } catch (error) {
      console.error('Error fetching dataset details:', error);
    }
    return null;
  };

  // Fetch dataset details when version is selected
  useEffect(() => {
    const fetchDatasetDetails = async () => {
      if (selectedVersion) {
        if (selectedVersion?.datasetVersionId) {
          const details = await getDatasetDetails(selectedVersion.datasetVersionId);
          if (details) {
            setDatasetVersionDetails({
              datasetId: details.datasetId,
              version: details.version,
              datasetName: details.datasetName || 'Unknown Dataset'
            });
          }
        }
      }
    };

    fetchDatasetDetails();
  }, [selectedVersion]);

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
            <Button
              onClick={handleRunPredictions}
              variant="primary"
              disabled={!selectedVersion || selectedVersion?.status !== 'TRAINING_COMPLETED'}
            >
              Run Predictions
            </Button>
            <Button
              onClick={handleCreateNewVersion}
            >
              Create New Version
            </Button>
            <Button
              onClick={handleRefresh}
              iconName="refresh"
            />
          </SpaceBetween>
        }
      >
        {model?.name}
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

      {/* Version Selector and Details Layout */}
      <Container>
        <SpaceBetween size="m">
          <div className={styles.versionSelectorLayout}>
            <div className={styles.versionSelector}>
              <VersionSelector
                modelVersions={versions || []}
                selectedVersion={selectedVersion}
                onVersionSelect={handleVersionSelect}
              />
            </div>
            
            <div className={styles.versionDetailsColumn}>
              {/* Version Details */}
              {selectedVersion && (
                <div className={styles.versionDetails}>
                  <ExpandableSection 
                    headerText="Version Details" 
                    variant="default"
                  >
                    <div className={styles.versionDetailsCard}>
                      <SpaceBetween size="s">
                        <ColumnLayout columns={3} variant="text-grid">
                          <div>
                            <Box variant="awsui-key-label">Status</Box>
                            <StatusIndicator type={getStatusColor(selectedVersion?.status)}>
                              {selectedVersion?.status || 'DRAFT'}
                            </StatusIndicator>
                          </div>
                          <div>
                            <Box variant="awsui-key-label">Target Feature</Box>
                            <div>{selectedVersion?.targetFeature || '-'}</div>
                          </div>
                          <div>
                            <Box variant="awsui-key-label">Version ID</Box>
                            <div>{selectedVersion?.id || '-'}</div>
                          </div>
                        </ColumnLayout>
                        <ColumnLayout columns={3} variant="text-grid">
                          <div>
                            <Box variant="awsui-key-label">Dataset Version</Box>
                            {selectedVersion?.datasetVersionId ? (
                              <Link
                                onFollow={(e) => {
                                  e.preventDefault();
                                  if (datasetVersionDetails) {
                                    navigate(`/datasets/${datasetVersionDetails.datasetId}?version=${datasetVersionDetails.version}`);
                                  }
                                }}
                              >
                                {datasetVersionDetails ? 
                                  `${datasetVersionDetails.datasetName} v${datasetVersionDetails.version}` : 
                                  'Unknown Dataset'
                                }
                              </Link>
                            ) : '-'}
                          </div>
                          <div>
                            <Box variant="awsui-key-label">Created</Box>
                            <div>{new Date(selectedVersion?.createdAt || '').toLocaleString()}</div>
                          </div>
                          <div>
                            <Box variant="awsui-key-label">Last Updated</Box>
                            <div>{new Date(selectedVersion?.updatedAt || '').toLocaleString()}</div>
                          </div>
                        </ColumnLayout>
                      </SpaceBetween>
                    </div>
                  </ExpandableSection>
                </div>
              )}
            </div>
          </div>
        </SpaceBetween>
      </Container>

      {/* Tabs */}
      <Tabs
        activeTabId={activeTab}
        onChange={({ detail }) => setActiveTab(detail.activeTabId)}
        tabs={[
          {
            id: 'details',
            label: 'Details',
            content: (
              <div className={styles.mainContentGrid}>
                {/* Left column - Pipeline */}
                <div className={styles.leftColumn}>
                  {selectedVersion && selectedVersion?.status === "TRAINING_COMPLETED" && (
                    <Container>
                      <SpaceBetween size="l">
                        <div className={styles.pipelineVisualizerContainer}>
                          <ModelPipelineVisualizer 
                            modelVersion={selectedVersion}
                          />
                          {!showingAlternativePipeline && (
                            <div className={styles.topPipelineBadge}>
                              <img 
                                src={TopPipelineIcon} 
                                alt="Top Pipeline" 
                                className={styles.topPipelineIcon}
                              />
                              <span>Top Pipeline</span>
                            </div>
                          )}
                        </div>
                        
                        <div className={styles.pipelineDescription}>
                          <Icon 
                            name="status-positive" 
                            size="small" 
                            variant="success" 
                          />
                          <span>
                            This pipeline out-performed over 1,000 evaluated pipelines using Genetic  Programming
                          </span>
                        </div>
                        {/* <ExpandableSection 
                          headerText="Alternative Pipelines" 
                          variant="footer"
                        >
                          <Box 
                            color="text-body-secondary"
                            className={styles.alternativePipelinesText}
                          >
                            Coming soon: Browse and compare alternative pipelines that were evaluated 
                            during the model training process. Each pipeline will include detailed 
                            performance metrics and explanations of the different approaches tested.
                          </Box>
                        </ExpandableSection> */}

                        {/* EDA's Model Analysis moved here */}
                        <ExpandableSection
                          headerText="EDA's Model Analysis"
                          headerDescription="AI-powered insights about your model"
                          variant="default"
                          defaultExpanded={true}
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
                        </ExpandableSection>
                      </SpaceBetween>
                    </Container>
                  )}
                </div>

                {/* Right column - Metrics */}
                <div className={styles.rightColumn}>
                  {selectedVersion && selectedVersion?.status === 'TRAINING_COMPLETED' && (
                    renderPerformanceSection(selectedVersion)
                  )}
                </div>
              </div>
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
