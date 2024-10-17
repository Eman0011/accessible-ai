import { Batch } from 'aws-sdk';
import {
  BATCH_JOB_DEFINITION,
  BATCH_JOB_QUEUE,
  TRAINING_OUTPUT_BUCKET
} from '../../../Config';
import type { Schema } from '../../data/resource';

export const handler: Schema["runTrainingJob"]["functionHandler"] = async (event) => {
  // arguments typed from `.arguments()`
  const { fileUrl, targetFeature, submittedBy, modelId, projectId } = event.arguments;

  console.log("Submitting BATCH JOB:")
  const batch = new Batch();

  const params = {
    jobName: `training-job-${submittedBy}-${Date.now()}`,  // Job name should be unique
    jobQueue: BATCH_JOB_QUEUE,                             // ARN of your Batch job queue
    jobDefinition: BATCH_JOB_DEFINITION,                   // ARN of your Batch job definition
    containerOverrides: {
      environment: [
        { name: 'BUCKET', value: TRAINING_OUTPUT_BUCKET },
        { name: 'FILE', value: fileUrl || '' },
        { name: 'TARGET', value: targetFeature || '' },
        { name: 'USER', value: submittedBy || '' },
        { name: 'MODEL_ID', value: modelId || '' },
        { name: 'PROJECT_ID', value: projectId || '' },
        { name: 'STAGE', value: 'prod' }
      ],
    },
  };
  console.log(params)

  try {
    // Submit the Batch job
    const submitJob = await batch.submitJob(params).promise();
    console.log("Response:")
    console.log(submitJob)
    const jobId = submitJob.jobId;

    return {
      fileUrl,
      targetFeature,
      submittedBy,
      jobId,
      projectId,
      status: 'SUBMITTED',
    };
  } catch (error) {
    console.error(error);
    throw new Error(`Failed to submit Batch job: ${error}`);
  }
};
