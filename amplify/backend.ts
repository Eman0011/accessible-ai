import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource';
import { runTrainingJob } from './functions/run-training/resource';
// import * as s3 from 'aws-cdk-lib/aws-s3';

const backend = defineBackend({
  auth,
  data,
  storage,
  runTrainingJob
});



// const s3Bucket = backend.storage.resources.bucket;
// const cfnBucket = s3Bucket.node.defaultChild as s3.CfnBucket;


// cfnBucket.corsConfiguration = {
//   corsRules: [{
//     allowedHeaders: ["*"],
//     allowedMethods: ["GET", "HEAD", "PUT", "POST", "DELETE"],
//     allowedOrigins: ["*"], // You can restrict this to your domains if needed
//     exposedHeaders: ["ETag", "x-amz-meta-custom-header"],
//     maxAge: 3000
//   }],
// };