import { Batch } from 'aws-sdk';
import {
  BATCH_JOB_DEFINITION,
  BATCH_JOB_QUEUE,
} from '../../../Config';
import type { Schema } from '../../data/resource';

export const handler: Schema["runTrainingJob"]["functionHandler"] = async (event) => {
  const { fileUrl, targetFeature, submittedBy, basePath, modelVersionId } = event.arguments;

  console.log("Submitting Training Job:")
  const batch = new Batch();
  const stage = process.env.NODE_ENV === 'development' ? 'dev' : 'prod';
  console.log('STAGE:', stage);
  
  const params = {
    jobName: `training-job-${submittedBy}-${Date.now()}`,
    jobQueue: BATCH_JOB_QUEUE,
    jobDefinition: BATCH_JOB_DEFINITION,
    containerOverrides: {
      environment: [
        { name: 'FILE', value: fileUrl || '' },
        { name: 'TARGET', value: targetFeature || '' },
        { name: 'USER', value: submittedBy || '' },
        { name: 'BASE_PATH', value: basePath },
        { name: 'MODEL_VERSION_ID', value: modelVersionId },
        { name: 'STAGE', value: "prod" }
      ],
    },
  };
  console.log(params)

  try {
    const submitJob = await batch.submitJob(params).promise();
    console.log("Response:")
    console.log(submitJob)
    const jobId = submitJob.jobId;

    return {
      fileUrl,
      targetFeature,
      submittedBy,
      jobId,
      basePath,
      status: 'SUBMITTED',
    };
  } catch (error) {
    console.error('Training error:', error);
    throw new Error(`Failed to submit Batch job: ${error}`);
  }
};
