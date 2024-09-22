export interface Project {
  id: string;
  name: string;
  owner: string;
  description: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  datasets?: Dataset[];
  models?: Model[];
}

export interface Dataset {
  id?: string;
  name: string;
  description?: string;
  owner?: string;
  version: number;
  s3Key?: string;
  uploadDate: string;
  size: number;
  rowCount: number;
  projectId?: string;
  project?: Project;
}

export interface Model {
  id: string;
  name: string;
  description: string;
  owner: string;
  version: number; // Ensure version is present
  projectId: string;
  project?: Project;
  createdAt: string;
  updatedAt: string;
  status: 'DRAFT' | 'SUBMITTED' | 'TRAINING' | 'TRAINING_COMPLETED' | 'TRAINING_FAILED' | 'PUBLISHED' | 'ARCHIVED';
  targetFeature?: string;
  fileUrl?: string;
  s3Key?: string;
  trainingJobId?: string;
  performanceMetrics?: any;
}

export interface ModelVersion {
  id: string;
  modelId: string;
  model?: Model;
  versionNumber: number;
  datasetId: string;
  dataset?: Dataset;
  datasetVersion: number;
  status: 'DRAFT' | 'SUBMITTED' | 'TRAINING' | 'TRAINING_COMPLETED' | 'TRAINING_FAILED' | 'PUBLISHED' | 'ARCHIVED';
  targetFeature: string;
  trainingJobId?: string;
  createdAt: string;
  updatedAt: string;
  performanceMetrics?: any;
  fileUrl: string;
  description: string;
  owner: string;
}

export interface TrainingJobResult {
  jobId: string;
  // Add other properties as needed
}