import { UserInfo } from '../types/models';

export function generateStoragePath(params: {
  userId: string;
  projectId: string;
  resourceType: 'datasets' | 'models';
  resourceId: string;
  version?: number;
  fileName?: string;
}) {
  const { userId, projectId, resourceType, resourceId, version, fileName } = params;
  
  // Build the base path
  let basePath = `users/${userId}/projects/${projectId}/${resourceType}/${resourceId}`;
  
  // Add version if provided
  if (version !== undefined) {
    basePath = `${basePath}/v${version}`;
  }
  
  // Add filename if provided
  return fileName ? `${basePath}/${fileName}` : basePath;
}

export function validateUserAccess(userInfo: UserInfo | null, userId: string): boolean {
  if (!userInfo) return false;
//   TODO update this to take in a URL and compare userId to the URL
  return userInfo.userId === userId; // Simple identity check
} 