import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { fetchAuthSession } from 'aws-amplify/auth';

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
    return JSON.parse(data) as T;
  } catch (error) {
    console.error('Error parsing JSON:', error);
    throw error;
  }
};

// Convenience function to download and parse JSON from S3
export const getS3JSONFromBucket = async <T>(key: string, bucket: string): Promise<T> => {
  const data = await downloadFromS3(key, bucket);
  return parseJSON<T>(data);
}; 