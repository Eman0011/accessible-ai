import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { runTrainingJob } from './functions/run-training/resource';
import { storage } from './storage/resource';
// import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from "aws-cdk-lib/aws-iam";

const backend = defineBackend({
  auth,
  data,
  storage,
  runTrainingJob
});

const runTrainingJobLabmda = backend.runTrainingJob.resources.lambda

const ecsPolicy = new iam.PolicyStatement({
  sid: "AllowRunECS",
  actions: [
    "ecs:RunTask",
    "ecs:DescribeTasks",
    "ecs:StopTask",
    "iam:PassRole"
  ],
  resources: ["*"],
})
runTrainingJobLabmda.addToRolePolicy(ecsPolicy)


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