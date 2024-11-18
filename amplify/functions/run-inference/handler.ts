import { Context } from 'aws-lambda';
import { Lambda, S3 } from 'aws-sdk';
import { Schema } from '../../data/resource';
import { LAMBDA_INFERENCE_FUNCTION } from '../../../Config';

const s3 = new S3();
const lambda = new Lambda();

export const handler: Schema["runModelInference"]["functionHandler"] = async (event, context: Context) => {
  console.debug('Inference request received:', {
    ...event.arguments,
    inputSize: event.arguments.input ? event.arguments.input.length : undefined,
    hasInputPath: !!event.arguments.inputDataPath,
    hasOutputPath: !!event.arguments.outputDataPath
  });

  try {
    const { basePath, modelVersionId, targetFeature, submittedBy, input, inputDataPath, outputDataPath } = event.arguments;
    
    // Validate required fields
    if (!basePath || !modelVersionId || !targetFeature || !submittedBy) {
      console.error('Missing required fields:', {
        hasBasePath: !!basePath,
        hasModelVersionId: !!modelVersionId,
        hasTargetFeature: !!targetFeature,
        hasSubmittedBy: !!submittedBy
      });
      throw new Error('Missing required fields');
    }

    // Validate that either input or inputDataPath is provided
    if (!input && !inputDataPath) {
      console.error('Neither input nor inputDataPath provided');
      throw new Error('Either input or inputDataPath must be provided');
    }

    console.debug('Processing paths:', {
      basePath,
      inputDataPath,
      outputDataPath,
      type: input ? 'ADHOC' : 'BATCH'
    });

    // Input should already be an object since we're using a.json()
    const payload = {
      submittedBy,
      modelVersionId,
      targetFeature,
      basePath,
      input,
      inputDataPath,
      outputDataPath
    };

    console.debug('Inference request received:', event);

    const lambdaResponse = await lambda.invoke({
      FunctionName: LAMBDA_INFERENCE_FUNCTION,
      InvocationType: 'RequestResponse',
      Payload: JSON.stringify(payload)
    }).promise();

    console.debug('Model loaded successfully');

    console.debug('Inference completed:', lambdaResponse);

    if (lambdaResponse.FunctionError) {
      throw new Error(`Lambda execution failed: ${lambdaResponse.FunctionError}`);
    }

    return JSON.parse(lambdaResponse.Payload as string);

  } catch (error) {
    console.error('Error during inference:', {
      error,
      arguments: event.arguments
    });
    throw error;
  }
};
