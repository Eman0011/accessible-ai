// import { S3 } from 'aws-sdk';
// import { Context } from 'aws-lambda';
// import { Schema } from '../../data/resource';  // Import the schema types from resource
// import * as joblib from 'joblib';  // Make sure joblib is bundled with Lambda

// const s3 = new S3();

// export const handler: Schema["runModelInference"]["functionHandler"] = async (event, context: Context) => {
//   try {
//     // Extract arguments using the schema types
//     const { modelPath, input } = event.arguments;

//     // Fetch the model from S3
//     const bucketName = process.env.MODEL_BUCKET_NAME as string;  // Ensure this env variable is set
//     const modelFile = await s3.getObject({
//       Bucket: bucketName,
//       Key: modelPath,
//     }).promise();

//     // Load the model using joblib (adjust this to match your model file format)
//     const model = joblib.load(modelFile.Body as Buffer);  // Ensure Body is cast as a Buffer

//     // Run inference
//     const predictions = model.predict([input]);

//     // Return the predictions
//     return {
//       predictions: predictions,
//     };
//   } catch (error) {
//     console.error('Error during inference:', error);

//     return {
//       error: 'An error occurred during inference.',
//       details: error.message,
//     };
//   }
// };
