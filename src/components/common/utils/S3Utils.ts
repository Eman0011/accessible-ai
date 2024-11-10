import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { fetchAuthSession } from 'aws-amplify/auth';
import { getFromCache, setInCache } from '../../../utils/CacheUtils';

// Create S3 client with credentials
const getS3Client = async () => {
  const { credentials } = await fetchAuthSession();
  return new S3Client({ 
    region: 'us-east-1',
    credentials: credentials
  });
};




export const parseS3Path = (s3Path: string): { bucket: string; key: string } => {
  const parts = s3Path.split('/');
  const bucket = parts[0]; // Assuming the first part is the bucket name
  const key = parts.slice(1).join('/'); // The rest is the key
  return { bucket, key };
};

export const getS3JSONFromBucket = async <T>(s3Path: string): Promise<T> => {
  // Check cache first
  const cachedData = getFromCache(s3Path);
  if (cachedData) {
    return cachedData as T;
  }

  try {
    const { bucket, key } = parseS3Path(s3Path);
    console.debug('Fetching from Bucket:', bucket, 'Key:', key);
    const s3Client = await getS3Client();
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
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
    setInCache(s3Path, data);
    
    return data;
  } catch (error) {
    console.error('Error fetching from S3:', error);
    throw error;
  }
}; 