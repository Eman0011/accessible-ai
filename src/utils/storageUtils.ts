import { UserInfo } from '../types/models';

interface StoragePathParams {
  userId: string;
  projectId: string;
  datasetId?: string;
  modelId?: string;
  predictionId?: string;
  version?: number;
  type?: 'input' | 'output';
  fileName?: string;
  timestamp?: number;  // Added for adhoc predictions
}

export function generateStoragePath(params: StoragePathParams): string {
  const { userId, projectId, datasetId, modelId, predictionId, version, type, fileName, timestamp } = params;
  
  let basePath = `users/${userId}/projects/${projectId}`;
  
  // Add resource-specific paths
  if (datasetId) {
    basePath = `${basePath}/datasets/${datasetId}`;
  } else if (modelId) {
    basePath = `${basePath}/models/${modelId}`;
  } else if (predictionId) {
    basePath = `${basePath}/predictions/${predictionId}`;
    
    // For adhoc predictions, add timestamp to prevent collisions
    if (timestamp) {
      basePath = `${basePath}/${timestamp}`;
    }
  }
  
  // Add version if provided
  if (version !== undefined) {
    basePath = `${basePath}/v${version}`;
  }
  
  // Add type (input/output) for predictions
  if (type) {
    basePath = `${basePath}/${type}`;
  }
  
  // Add filename if provided
  const finalPath = fileName ? `${basePath}/${fileName}` : basePath;
  
  console.debug('Generated storage path:', {
    params,
    finalPath,
    pathComponents: {
      basePath,
      resourcePath: datasetId || modelId || predictionId,
      version,
      type,
      fileName,
      timestamp
    }
  });
  
  return finalPath;
}

export function generatePredictionOutputPath(params: {
  projectId: string;
  modelId: string;
  predictionId: string;
  fileName: string;
  timestamp?: number;  // Added for adhoc predictions
  type: 'ADHOC' | 'BATCH';
}): string {
  const { projectId, modelId, predictionId, fileName, timestamp, type } = params;
  
  let outputPath = `projects/${projectId}/models/${modelId}/predictions/${predictionId}`;
  
  // For adhoc predictions, include timestamp in path
  if (type === 'ADHOC' && timestamp) {
    outputPath = `${outputPath}/${timestamp}`;
  }
  
  outputPath = `${outputPath}/output/${fileName}`;
  
  console.debug('Generated prediction output path:', {
    params,
    outputPath,
    pathComponents: {
      projectId,
      modelId,
      predictionId,
      fileName,
      timestamp,
      type
    }
  });
  
  return outputPath;
}

export function validateUserAccess(userInfo: UserInfo | null, userId: string): boolean {
  if (!userInfo) return false;
//   TODO update this to take in a URL and compare userId to the URL
  return userInfo.userId === userId; // Simple identity check
} 