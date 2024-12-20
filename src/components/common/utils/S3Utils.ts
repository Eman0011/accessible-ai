import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { fetchAuthSession } from 'aws-amplify/auth';
import Papa from 'papaparse';
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
  const path = s3Path.startsWith('s3://') ? s3Path.substring(5) : s3Path;
  const parts = path.split('/');
  return { bucket: parts[0], key: parts.slice(1).join('/') };
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
    
    // Replace literal NaN with "NaN" string before parsing
    const sanitizedText = text.replace(/: NaN/g, ': "NaN"');
    
    // Parse JSON with a reviver function to handle special values
    const data = JSON.parse(sanitizedText, (_, value) => {
      if (value === "NaN") return NaN;
      if (value === "null" || value === null) return null;
      if (value === "None") return null;
      return value;
    }) as T;
    
    // Store in cache
    setInCache(s3Path, data);
    
    return data;
  } catch (error) {
    console.error('Error fetching from S3:', error);
    throw error;
  }
};

interface CSVOptions {
    preview?: boolean;
    previewRows?: number;
}

export const getCSVFromS3 = async (
    s3Path: string,
    options: CSVOptions = { preview: true, previewRows: 10 }
): Promise<{ data: any[], meta: Papa.ParseMeta }> => {
    try {
        const cacheKey = `${options.preview ? 'preview:' : ''}${s3Path}`;
        
        // Check cache first
        const cachedData = getFromCache(cacheKey);
        if (cachedData) {
            console.debug('Cache hit for CSV:', cacheKey);
            // Ensure cachedData has the required structure
            if (typeof cachedData === 'object' && cachedData !== null && 'data' in cachedData && 'meta' in cachedData) {
              return cachedData as { data: any[], meta: Papa.ParseMeta };
            } else {
                throw new Error('Cached data is missing required properties');
            }
        }
        console.debug('Cache miss for CSV:', cacheKey);

        // Parse S3 URL to get bucket and key
        const s3Url = new URL(s3Path.replace('s3://', 'https://'));
        const bucket = s3Url.hostname;
        const key = s3Url.pathname.slice(1);

        console.debug('Fetching CSV from S3:', {
            bucket,
            key,
            s3Path,
            preview: options.preview
        });

        const { credentials } = await fetchAuthSession();
        const s3Client = new S3Client({
            region: 'us-east-1',
            credentials
        });

        const command = new GetObjectCommand({
            Bucket: bucket,
            Key: key
        });

        const response = await s3Client.send(command);
        const csvContent = await response.Body?.transformToString();

        if (!csvContent) {
            throw new Error('No content received from S3');
        }

        return new Promise((resolve, reject) => {
            Papa.parse(csvContent, {
                header: true,
                preview: options.preview ? options.previewRows : undefined,
                complete: (results) => {
                    console.debug('Parsed CSV from S3:', {
                        rowCount: results.data.length,
                        headers: results.meta.fields,
                        firstRow: results.data[0],
                        errors: results.errors
                    });

                    const result = {
                        data: results.data,
                        meta: results.meta
                    };

                    // Cache the results
                    setInCache(cacheKey, result);

                    resolve(result);
                },
                error: (error: any) => {
                    console.error('Error parsing CSV:', error);
                    reject(error);
                }
            });
        });
    } catch (error) {
        console.error('Error fetching CSV from S3:', error);
        throw error;
    }
}; 