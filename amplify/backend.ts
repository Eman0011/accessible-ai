import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { runModelInference } from './functions/run-inference/resource';
import { runTrainingJob } from './functions/run-training/resource';
import { storage } from './storage/resource';
// import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from "aws-cdk-lib/aws-iam";
import { BATCH_JOB_ROLE } from '../Config';

const backend = defineBackend({
  auth,
  data,
  storage,
  runTrainingJob,
  runModelInference
});

const runTrainingJobLambda = backend.runTrainingJob.resources.lambda

runTrainingJobLambda.addToRolePolicy(new iam.PolicyStatement({
  sid: "AllowSubmitBatchJobs",
  actions: [
    "batch:SubmitJob",
    "batch:DescribeJobs",
    "batch:TerminateJob",  // Optional if you want Lambda to terminate jobs
  ],
  resources: ["*"],
}));

runTrainingJobLambda.addToRolePolicy(new iam.PolicyStatement({
  sid: "AllowPassRole",
  actions: ["iam:PassRole"],
  resources: [
    BATCH_JOB_ROLE
  ],
  effect: iam.Effect.ALLOW,
}));


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