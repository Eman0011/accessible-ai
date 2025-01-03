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
import { useAIGeneration } from '../../../components/common/eda/client';
import { Model, ModelMetrics, ModelReport, ModelStatus, ModelVersion, PipelineStep } from '../../../types/models';
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

const validateReport = (report: unknown): report is ModelReport => {
  console.debug('Validating report structure');
  
  if (!report || typeof report !== 'object' || Array.isArray(report)) {
    console.debug('Report is not a valid object:', typeof report);
    return false;
  }

  const r = report as ModelReport;

  // Check summary section
  const hasSummary = r.summary &&
    typeof r.summary.overview === 'string' &&
    Array.isArray(r.summary.keyFindings) &&
    typeof r.summary.title === 'string' &&
    Array.isArray(r.summary.recommendations) &&
    r.summary.deployment &&
    typeof r.summary.deployment.readiness === 'string' &&
    Array.isArray(r.summary.deployment.monitoringRecommendations) &&
    Array.isArray(r.summary.deployment.considerations);

  if (!hasSummary) {
    console.debug('Invalid summary section');
    return false;
  }

  // Check pipeline section
  const hasPipeline = r.pipeline &&
    typeof r.pipeline.overview === 'string' &&
    Array.isArray(r.pipeline.steps) &&
    r.pipeline.steps.every((step) =>
      Array.isArray(step.strengths) &&
      typeof step.impact === 'string' &&
      typeof step.name === 'string' &&
      typeof step.description === 'string' &&
      Array.isArray(step.parameters) &&
      Array.isArray(step.limitations)
    );

  if (!hasPipeline) {
    console.debug('Invalid pipeline section');
    return false;
  }

  // Check performance section
  const hasPerformance = r.performance &&
    typeof r.performance.overview === 'string' &&
    Array.isArray(r.performance.strengths) &&
    r.performance.metrics &&
    typeof r.performance.metrics === 'object' &&
    Array.isArray(r.performance.limitations);

  if (!hasPerformance) {
    console.debug('Invalid performance section');
    return false;
  }

  return true;
};

const ModelDetails: React.FC = () => {
  const { modelId } = useParams<{ modelId: string }>();
  const navigate = useNavigate();
  const [model, setModel] = useState<Model | null>(null);
  const [versions, setVersions] = useState<ModelVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<ModelVersion | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('details');
  const [metrics, setMetrics] = useState<ModelMetrics | null>(null);
  const [pipeline, setPipeline] = useState<PipelineStep[]>([]);
  const [modelReport, setModelReport] = useState<ModelReport | null>(null);
  const [showEnterpriseAlert, setShowEnterpriseAlert] = useState(true);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [datasetVersionDetails, setDatasetVersionDetails] = useState<{
    datasetId: string,
    version: number,
    datasetName: string,
    datasetDescription: string,
    rowCount: number,
    size: number
  } | null>(null);
  const [showingAlternativePipeline] = useState(false);
  
  const [featureNames, setFeatureNames] = useState<string[]>([]);
  const [reportError, setReportError] = useState<string | null>(null);
  const [justGeneratedReport, setJustGeneratedReport] = useState(false);
  const [{ data: reportData, isLoading: reportGenerating }, generateReport] = useAIGeneration("generateModelVersionReport");

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
      const basePath = version.s3OutputPath;
      if (!basePath) {
        console.error('No valid S3 path found in version:', version);
        return;
      }

      // Reset error states
      setMetricsError(null);
      setReportError(null);

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
        setPipeline([]);
      }

      try {
        const featureNamesData = await getS3JSONFromBucket<string[]>(
          `${basePath}/feature_names.json`
        );
        setFeatureNames(featureNamesData);
      } catch (featureError) {
        console.error('Error fetching feature names:', featureError);
        setFeatureNames([]);
      }
    } catch (fetchError) {
      console.error('Error in fetchModelOutputData:', fetchError);
      setMetricsError('Failed to load model data');
      setMetrics(null);
      setPipeline([]);
    }
  };

  const generateModelReport = async () => {
    if (!model || !selectedVersion || !datasetVersionDetails) {
      console.debug('Missing required data for report generation');
      return;
    }

    try {
      generateReport({
        modelName: model.name,
        modelDescription: model.description || 'No description available',
        modelPipeline: JSON.stringify(pipeline),
        performanceMetrics: JSON.stringify(metrics),
        featureNames: JSON.stringify(featureNames),
        datasetName: datasetVersionDetails.datasetName,
        datasetDescription: datasetVersionDetails.datasetDescription,
        datasetRows: datasetVersionDetails.rowCount,
        datasetSize: datasetVersionDetails.size,
        targetFeature: selectedVersion.targetFeature || 'No target feature available'
      });
      setJustGeneratedReport(true);
    } catch (error) {
      console.error('Error generating report:', error);
      setReportError('Failed to generate report');
    }
  };

  const loadReportFromDatabase = async () => {
    if (!selectedVersion) return false;

    try {
      console.debug('Loading report for version:', selectedVersion.id);
      const { data: modelVersion } = await client.models.ModelVersion.get({ 
        id: selectedVersion.id 
      });
      
      if (!modelVersion?.report) {
        console.debug('No report found in database for version:', selectedVersion.id);
        return false;
      }

      // Parse the report if it's a string
      const reportData = typeof modelVersion.report === 'string' ? 
        JSON.parse(modelVersion.report) : 
        modelVersion.report;

      if (validateReport(reportData)) {
        console.debug('Report structure is valid for version:', selectedVersion.id);
        setModelReport(reportData);
        return true;
      }

      console.debug('Invalid report structure for version:', selectedVersion.id);
      return false;
    } catch (error) {
      console.error('Error loading report for version:', selectedVersion.id, error);
      return false;
    }
  };

  const handleVersionSelect = async (version: ModelVersion | null) => {
    if (version) {
      console.debug('Switching to version:', version.id);
      
      // Reset all state variables to ensure clean slate
      setModelReport(null);
      setMetrics(null);
      setPipeline([]);
      setFeatureNames([]);
      setDatasetVersionDetails(null);
      setReportError(null);
      setMetricsError(null);
      setJustGeneratedReport(false);
      
      // Set the new version last to trigger the useEffect
      setSelectedVersion(version);
      
      console.debug('Reset complete for version:', version.id);
    }
  };

  // Combine dataset and model output fetching into a single useEffect
  useEffect(() => {
    if (selectedVersion?.status === "TRAINING_COMPLETED") {
      const fetchAllData = async () => {
        try {
          // Fetch model output data
          await fetchModelOutputData(selectedVersion);
          
          // Fetch dataset details if we have a dataset version ID
          if (selectedVersion.datasetVersionId) {
            try {
              const { data: datasetVersion } = await client.models.DatasetVersion.get({ 
                id: selectedVersion.datasetVersionId 
              });
              
              if (datasetVersion) {
                const { data: dataset } = await client.models.Dataset.get({ 
                  id: datasetVersion.datasetId 
                });
                
                if (dataset) {
                  setDatasetVersionDetails({
                    datasetId: datasetVersion.datasetId,
                    version: datasetVersion.version,
                    datasetName: dataset.name || 'Unknown Dataset',
                    datasetDescription: dataset.description || 'No description available',
                    rowCount: datasetVersion.rowCount,
                    size: datasetVersion.size
                  });
                }
              }
            } catch (error) {
              console.error('Error fetching dataset details:', error);
            }
          }
        } catch (error) {
          console.error('Error fetching data:', error);
        }
      };

      fetchAllData();
    }
  }, [selectedVersion?.id]); // Only depend on the version ID

  // Single useEffect for report generation and management
  useEffect(() => {
    const checkAndGenerateReport = async () => {
      if (!selectedVersion?.id) return;

      const conditions = {
        status: selectedVersion?.status,
        hasMetrics: !!metrics,
        pipelineLength: pipeline.length,
        featureNamesLength: featureNames.length,
        hasDatasetDetails: !!datasetVersionDetails
      };
      
      console.debug('Checking report generation conditions:', conditions);

      if (conditions.status === 'TRAINING_COMPLETED' && 
          conditions.hasMetrics && 
          conditions.pipelineLength > 0 && 
          conditions.featureNamesLength > 0 && 
          conditions.hasDatasetDetails) {
        
        // Try to load existing report
        const existingReport = await loadReportFromDatabase();
        console.debug(`Version ${selectedVersion.id} has existing report:`, existingReport);
        
        // Generate if no report exists or if validation failed
        if (!existingReport && !reportGenerating) {
          console.debug(`Generating report for version ${selectedVersion.id}`);
          await generateModelReport();
        }
      }
    };

    checkAndGenerateReport();
  }, [
    selectedVersion?.id,
    metrics,
    pipeline,
    featureNames,
    datasetVersionDetails
  ]);

  // Handle report data updates in a separate useEffect
  useEffect(() => {
    if (!reportData || !selectedVersion || !justGeneratedReport) return;

    const processReport = async () => {
      try {
        console.debug('Processing newly generated report for version:', selectedVersion.id);
        
        const parsedReport = typeof reportData === 'string' ? 
          JSON.parse(JSON.parse(reportData)) : 
          reportData;
        
        if (validateReport(parsedReport)) {
          // Save report and update state
          await client.models.ModelVersion.update({
            id: selectedVersion.id,
            report: JSON.stringify(parsedReport)
          });
          setModelReport(parsedReport);
          console.debug('Successfully saved newly generated report for version:', selectedVersion.id);
        } else {
          console.error('Validation failed for newly generated report');
          setReportError('Generated report has invalid structure');
        }
      } catch (error) {
        console.error('Error processing report data:', error);
        setReportError('Failed to process report data');
      } finally {
        setJustGeneratedReport(false); // Reset the flag after processing
      }
    };

    processReport();
  }, [reportData, selectedVersion?.id, justGeneratedReport]);

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

  const renderModelAnalysis = () => {
    if (reportError) {
      return <Alert type="error">{reportError}</Alert>;
    }

    if (reportGenerating) {
      return (
        <Box textAlign="center" padding={{ vertical: 'xl' }}>
          <SpaceBetween size="m" alignItems="center">
            <Spinner size="large" />
            <Box variant="p">Generating insights...</Box>
          </SpaceBetween>
        </Box>
      );
    }

    if (modelReport) {
      return renderReport(modelReport);
    }

    if (showEnterpriseAlert) {
      return (
        <Alert
          type="info"
          header="Enterprise Feature"
          dismissible={true}
          onDismiss={() => setShowEnterpriseAlert(false)}
        >
          Get detailed AI-powered analysis of your models with our Enterprise plan. 
          Our assistant EDA will help you understand complex ML concepts and make better decisions.
        </Alert>
      );
    }

    return null;
  };

  const renderReport = (report: ModelReport) => {
    const isModelApproved = report.summary.deployment.readiness.toLowerCase().includes('ready');
    
    return (
      <div className={styles.reportContainer}>
        <SpaceBetween size="l">
          {/* Summary Section with Deployment Status */}
          <Container header={
            <Header variant="h2">
              <div className={styles.modelSummaryHeader}>
                Model Summary
              </div>
            </Header>
          }>
            <SpaceBetween size="m">
              <div>
                <Box variant="awsui-key-label">Title</Box>
                <div>{report.summary.title}</div>
              </div>
              
              <div>
                <Box variant="awsui-key-label">Overview</Box>
                <div>{report.summary.overview}</div>
              </div>
              
              <div>
                <Box variant="awsui-key-label">Key Findings</Box>
                <ul>
                  {report.summary.keyFindings.map((finding, index) => (
                    <li key={index}>{finding}</li>
                  ))}
                </ul>
              </div>
              
              <div className={`${styles.deploymentStatus} ${isModelApproved ? styles.approved : styles.rejected}`}>
                <Icon
                  name={isModelApproved ? "status-positive" : "status-negative"}
                  size="large"
                  variant={isModelApproved ? "success" : "error"}
                />
                <div>
                  <Box variant="awsui-key-label">Deployment Readiness</Box>
                  <div>{report.summary.deployment.readiness}</div>
                  <Box variant="awsui-key-label">Considerations</Box>
                  <ul>
                    {report.summary.deployment.considerations.map((consideration, index) => (
                      <li key={index}>{consideration}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </SpaceBetween>
          </Container>

          {/* Pipeline Section */}
          <Container header={<Header variant="h2">Pipeline Analysis</Header>}>
            <SpaceBetween size="m">
              <div>
                <Box variant="awsui-key-label">Overview</Box>
                <div>{report.pipeline.overview}</div>
              </div>
              
              {report.pipeline.steps.map((step, index) => (
                <div key={index} className={styles.pipelineStep}>
                  <div className={styles.stepHeader}>
                    <Icon
                      name="settings"
                      size="medium"
                    />
                    <Header variant="h3">{step.name}</Header>
                  </div>
                  
                  <Box variant="awsui-key-label">Description</Box>
                  <div>{step.description}</div>
                  
                  <Box variant="awsui-key-label">Impact Analysis</Box>
                  <div>{step.impact}</div>
                  
                  <Box variant="awsui-key-label">Strengths</Box>
                  <ul>
                    {step.strengths.map((strength, idx) => (
                      <li key={idx}>{strength}</li>
                    ))}
                  </ul>
                  
                  <Box variant="awsui-key-label">Limitations</Box>
                  <ul>
                    {step.limitations.map((limitation, idx) => (
                      <li key={idx}>{limitation}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </SpaceBetween>
          </Container>

          {/* Performance Section */}
          <Container header={<Header variant="h2">Performance Analysis</Header>}>
            <SpaceBetween size="m">
              <div>
                <Box variant="awsui-key-label">Expert Analysis</Box>
                <div>{report.performance.overview}</div>
              </div>
              
              <div>
                <Box variant="awsui-key-label">Metrics Analysis</Box>
                <ul>
                  {Object.entries(report.performance.metrics).map(([key, value], index) => (
                    <li key={index}>
                      <strong>{key}:</strong> {value.interpretation}
                    </li>
                  ))}
                </ul>
              </div>
              
              <div>
                <Box variant="awsui-key-label">Strengths</Box>
                <ul>
                  {report.performance.strengths.map((strength, index) => (
                    <li key={index}>{strength}</li>
                  ))}
                </ul>
              </div>
              
              <div>
                <Box variant="awsui-key-label">Limitations</Box>
                <ul>
                  {report.performance.limitations.map((limitation, index) => (
                    <li key={index}>{limitation}</li>
                  ))}
                </ul>
              </div>
            </SpaceBetween>
          </Container>
        </SpaceBetween>
      </div>
    );
  };

  const handleRefreshReport = async () => {
    if (!model || !selectedVersion || !datasetVersionDetails) {
      console.error('Missing required data for report generation');
      return;
    }

    try {
      await generateModelReport();
    } catch (error) {
      console.error('Error regenerating report:', error);
      setReportError('Failed to regenerate report');
    }
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
                            This pipeline out-performed over 1,000 evaluated pipelines using Genetic Programming
                          </span>
                        </div>

                        {/* EDA's Model Analysis */}
                        <ExpandableSection
                          headerText="EDA's Model Analysis"
                          headerDescription="AI-powered insights about your model"
                          variant="default"
                          defaultExpanded={true}
                        >
                          <Button onClick={handleRefreshReport} iconName="refresh">
                            Refresh Report
                          </Button>
                          <div className={styles.edaContent}>
                            <div className={styles.reportContainer}>
                              {renderModelAnalysis()}
                            </div>
                          </div>
                        </ExpandableSection>
                      </SpaceBetween>
                    </Container>
                  )}
                </div>

                {/* Right column - Metrics */}
                <div className={styles.rightColumn}>
                  {selectedVersion && selectedVersion?.status === 'TRAINING_COMPLETED' && (
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
                                      { id: 'metric', header: 'Class', cell: (item) => item.metric },
                                      { id: 'precision', header: 'Precision', cell: (item) => item.precision?.toFixed(4) || '-' },
                                      { id: 'recall', header: 'Recall', cell: (item) => item.recall?.toFixed(4) || '-' },
                                      { id: 'f1-score', header: 'F1 Score', cell: (item) => item['f1-score']?.toFixed(4) || '-' },
                                      { id: 'support', header: 'Support', cell: (item) => item.support || '-' },
                                    ]}
                                    items={Object.entries(metrics.classification_report).map(([key, value]) => ({
                                      metric: key,
                                      ...value
                                    }))}
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
