export interface Project {
  id: string;
  name: string;
  owner: string;
  description?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  datasets?: Dataset[];
  models?: Model[];
}

export interface Dataset {
  id: string;
  name: string;
  description: string;
  owner: string;
  projectId: string;
  project?: Project;
  createdAt?: string | null;
  updatedAt?: string | null;
  datasetVersions?: DatasetVersion[];
  s3Key?: string;
}

export interface DatasetVersion {
  id: string;
  datasetId: string;
  version: number;
  owner?: string;
  s3Key: string;
  size: number;
  rowCount: number;
  uploadDate: string;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface Model {
  id: string;
  name: string;
  description: string;
  owner: string;
  projectId: string;
  project?: Project;
  createdAt?: string | null;
  updatedAt?: string | null;
  modelVersions?: ModelVersion[];
}

export interface ModelVersion {
  id: string;
  modelId: string;
  model?: Model;
  version: number;
  status: ModelStatus;
  targetFeature?: string;
  fileUrl: string;
  s3OutputPath?: string;
  trainingJobId?: string;
  performanceMetrics?: Record<string, number>;
  trainingConfig?: any;
  trainingResources?: any;
  environmentDetails?: any;
  trainingTime?: number;
  createdAt?: string | null;
  updatedAt?: string | null;
  datasetVersionId: string;
  datasetVersion?: DatasetVersion;
  inputFeatures?: string[];
  modelParameters?: Record<string, any>;
}

export type ModelStatus = 
  | 'DRAFT' 
  | 'SUBMITTED' 
  | 'TRAINING' 
  | 'TRAINING_COMPLETED' 
  | 'TRAINING_FAILED' 
  | 'PUBLISHED' 
  | 'ARCHIVED';

export interface TrainingJobResult {
  jobId: string;
  status: string;
  startTime?: string;
  endTime?: string;
  logStreamName?: string;
}

export interface UserInfo {
  userId: string;
  username: string;
  email: string;
  organizationId: string;
  role: UserRole;
}

export interface Organization {
  id: string;
  name: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
  users?: User[];
  projects?: Project[];
}

export interface User {
  id: string;
  username: string;
  email: string;
  organizationId: string;
  organization?: Organization;
  role: UserRole;
  title?: string;
  level?: UserLevel;
  phoneNumber?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface OrganizationInvite {
  id: string;
  organizationId: string;
  organization?: Organization;
  email: string;
  status: InviteStatus;
  invitedBy: string;
  expiresAt: string;
  createdAt?: string;
  updatedAt?: string;
}

export type UserRole = 'admin' | 'member';
export type UserLevel = 'junior' | 'senior' | 'manager';
export type InviteStatus = 'pending' | 'accepted' | 'rejected';

export interface OrganizationAccess {
  organizationId: string;
  role: 'admin' | 'member' | 'viewer';
  permissions: string[];
}

export type PredictionType = 'ADHOC' | 'BATCH';
export type PredictionStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';

export interface Prediction {
  id: string;
  modelVersionId: string;
  projectId: string;
  type: PredictionType;
  status: PredictionStatus;
  submittedBy: string;
  
  // Input data stored as stringified JSON
  adhocInput?: string;
  inputDataPath?: string;
  
  // Output data stored as stringified JSON
  adhocOutput?: string;
  outputDataPath?: string;
  
  // Performance metrics
  inferenceLatency?: number;
  computeResources?: string;  // Stored as stringified JSON
  environmentDetails?: string;  // Stored as stringified JSON
  error?: string;
  
  // Timestamps
  startTime?: string | null;
  endTime?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  
  // Relationships
  modelVersion?: ModelVersion;
  project?: Project;
}

export interface PipelineStep {
    step_name: string; // Name of the step
    class_name: string; // Class name of the step
    module: string; // Module from which the step is imported
    params: { [key: string]: any }; // Parameters for the step
}

export interface PipelineStepIcon {
  step_name: string;
  class_name: string;
  module: string;
  params: Record<string, any>;
}

export interface ModelMetrics {
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
      'f1-score': number;
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

export interface ModelReport {
  summary: {
    title: string;
    overview: string;
    keyFindings: string[];
    recommendations: string[];
    deployment: {
      readiness: string;
      considerations: string[];
      monitoringRecommendations: string[];
    };
  };
  pipeline: {
    overview: string;
    steps: Array<{
      name: string;
      description: string;
      impact: string;
      strengths: string[];
      limitations: string[];
      parameters?: {
        name: string;
        value: any;
        impact: string;
      }[];
    }>;
  };
  performance: {
    overview: string;
    metrics: {
      [key: string]: {
        interpretation: string;
        analysis?: string;
      };
    };
    strengths: string[];
    limitations: string[];
  };
}