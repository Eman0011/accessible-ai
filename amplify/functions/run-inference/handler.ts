import { Context } from 'aws-lambda';
import { Lambda, S3 } from 'aws-sdk';
import { Schema } from '../../data/resource';
import { LAMBDA_INFERENCE_FUNCTION } from '../../../Config';

const s3 = new S3();
const lambda = new Lambda();

export const handler: Schema["runModelInference"]["functionHandler"] = async (event, context: Context) => {
  try {
    const { basePath, modelVersionId, targetFeature, submittedBy, input, inputDataPath, outputDataPath } = event.arguments;
    
    // Validate required fields
    if (!basePath || !modelVersionId || !targetFeature || !submittedBy) {
      throw new Error('Missing required fields');
    }

    // Validate that either input or inputDataPath is provided
    if (!input && !inputDataPath) {
      throw new Error('Either input or inputDataPath must be provided');
    }

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

    console.log('Invoking inference lambda with payload:', JSON.stringify(payload, null, 2));

    const lambdaResponse = await lambda.invoke({
      FunctionName: LAMBDA_INFERENCE_FUNCTION,
      InvocationType: 'RequestResponse',
      Payload: JSON.stringify(payload)
    }).promise();

    console.log('Lambda response:', lambdaResponse);

    if (lambdaResponse.FunctionError) {
      throw new Error(`Lambda execution failed: ${lambdaResponse.FunctionError}`);
    }

    return JSON.parse(lambdaResponse.Payload as string);

  } catch (error) {
    console.error('Error during inference:', error);
    throw error;
  }
};
