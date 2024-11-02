import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { fetchAuthSession } from 'aws-amplify/auth';
import { globalS3Cache } from '../../../utils/CacheUtils';

// Downloads raw data from S3 bucket
export const downloadFromS3 = async (key: string, bucket: string): Promise<string> => {
  try {
    const session = await fetchAuthSession();
    const s3Client = new S3Client({
      region: 'us-east-1',
      credentials: session.credentials,
    });

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const response = await s3Client.send(command);
    return await response.Body?.transformToString() || '';
  } catch (error) {
    console.error('Error downloading from S3:', error);
    throw error;
  }
};

// Helper to parse JSON from string data
export const parseJSON = <T>(data: string): T => {
  try {
    console.log('Parsing JSON:', data);
    return JSON.parse(data) as T;
  } catch (error) {
    console.error('Error parsing JSON:', error);
    throw error;
  }
};

// Convenience function to download and parse JSON from S3
export const getS3JSONFromBucket = async <T>(key: string, bucket: string): Promise<T> => {
  // Check cache first
  const cacheKey = `${bucket}/${key}`;
  const cachedData = globalS3Cache.get(cacheKey);
  if (cachedData) {
    console.log('Cache hit for:', cacheKey);
    return cachedData;
  }

  try {
    const rawData = await downloadFromS3(key, bucket);
    const data = parseJSON<T>(rawData);
    
    // Store in cache
    globalS3Cache.put(cacheKey, data);
    
    return data;
  } catch (error) {
    console.error('Error fetching from S3:', error);
    throw error;
  }
}; 