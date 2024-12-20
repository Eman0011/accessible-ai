import { Context } from 'aws-lambda';
import { Lambda } from 'aws-sdk';
import { LAMBDA_INFERENCE_FUNCTION } from '../../../Config';
import { Schema } from '../../data/resource';

const lambda = new Lambda();

export const handler: Schema["runModelInference"]["functionHandler"] = async (event, context: Context) => {
  console.debug('Inference request received:', {
    ...event.arguments,
    hasInputPath: !!event.arguments.inputDataPath,
    hasOutputPath: !!event.arguments.outputDataPath
  });

  const { predictionId } = event.arguments;

  try {
    const { basePath, modelVersionId, targetFeature, submittedBy, input, inputDataPath, outputDataPath } = event.arguments;
    
    // Validate required fields
    if (!basePath || !predictionId || !modelVersionId || !targetFeature || !submittedBy) {
      console.error('Missing required fields:', {
        hasBasePath: !!basePath,
        hasPredictionId: !!predictionId,
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

    const payload = {
      submittedBy,
      predictionId,
      modelVersionId,
      targetFeature,
      basePath,
      input,
      inputDataPath,
      outputDataPath,
      isDev: true,
    };

    const lambdaResponse = await lambda.invoke({
      FunctionName: LAMBDA_INFERENCE_FUNCTION,
      InvocationType: 'RequestResponse',
      Payload: JSON.stringify(payload)
    }).promise();

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
