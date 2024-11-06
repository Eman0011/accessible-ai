import { getFromCache, setInCache } from '../../../utils/CacheUtils';
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { fetchAuthSession } from 'aws-amplify/auth';

// Create S3 client with credentials
const getS3Client = async () => {
  const { credentials } = await fetchAuthSession();
  return new S3Client({ 
    region: 'us-east-1',
    credentials: credentials
  });
};

export const getS3JSONFromBucket = async <T>(key: string, bucket: string): Promise<T> => {
  // Remove bucket prefix from key if it exists
  const cleanKey = key.replace(`${bucket}/`, '');
  
  // Create consistent cache key
  const cacheKey = `${bucket}/${cleanKey}`;
  
  // Check cache first
  const cachedData = getFromCache(cacheKey);
  if (cachedData) {
    return cachedData as T;
  }

  try {
    const s3Client = await getS3Client();
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: cleanKey,
    });

    const response = await s3Client.send(command);
    
    if (!response.Body) {
      throw new Error('No data received from S3');
    }

    // Convert stream to text
    const reader = response.Body.transformToString();
    const text = await reader;
    const data = JSON.parse(text) as T;
    
    // Store in cache
    setInCache(cacheKey, data);
    
    return data;
  } catch (error) {
    console.error('Error fetching from S3:', error);
    throw error;
  }
}; 