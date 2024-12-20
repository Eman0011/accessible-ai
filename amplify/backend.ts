import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { runModelInference } from './functions/run-inference/resource';
import { runTrainingJob } from './functions/run-training/resource';
import { storage } from './storage/resource';
// import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from "aws-cdk-lib/aws-iam";
import { AAI_PUBLIC_BUCKET, BATCH_JOB_ROLE, PREDICTIONS_OUTPUT_BUCKET, TRAINING_OUTPUT_BUCKET } from '../Config';

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

// Add S3 read permissions to the authenticated user role
const authenticatedRole = backend.auth.resources.authenticatedUserIamRole;

authenticatedRole.addToPrincipalPolicy(
  new iam.PolicyStatement({
    effect: iam.Effect.ALLOW,
    actions: [
      's3:GetObject',
      's3:ListBucket',
      's3:GetBucketLocation',
      's3:ListBucketMultipartUploads'
    ],
    resources: [
      `arn:aws:s3:::${TRAINING_OUTPUT_BUCKET}`,
      `arn:aws:s3:::${TRAINING_OUTPUT_BUCKET}/*`,
    ]
  })
);

// Add a separate policy for ListAllMyBuckets
authenticatedRole.addToPrincipalPolicy(
  new iam.PolicyStatement({
    effect: iam.Effect.ALLOW,
    actions: ['s3:ListAllMyBuckets'],
    resources: ['*']
  })
);

// Add S3 permissions for predictions output bucket
authenticatedRole.addToPrincipalPolicy(
  new iam.PolicyStatement({
    effect: iam.Effect.ALLOW,
    actions: [
      's3:GetObject',
      's3:ListBucket',
      's3:GetBucketLocation',
    ],
    resources: [
      `arn:aws:s3:::${PREDICTIONS_OUTPUT_BUCKET}`,
      `arn:aws:s3:::${PREDICTIONS_OUTPUT_BUCKET}/*`,
    ]
  })
);

// Add S3 permissions for accessible-ai public bucket
authenticatedRole.addToPrincipalPolicy(
  new iam.PolicyStatement({
    effect: iam.Effect.ALLOW,
    actions: [
      's3:GetObject',
      's3:ListBucket',
      's3:GetBucketLocation',
    ],
    resources: [
      `arn:aws:s3:::${AAI_PUBLIC_BUCKET}`,
      `arn:aws:s3:::${AAI_PUBLIC_BUCKET}/*`,
    ]
  })
);

// Add a separate policy for run-inference lambda
const runInferenceLambda = backend.runModelInference.resources.lambda;

runInferenceLambda.addToRolePolicy(new iam.PolicyStatement({
  sid: "AllowRunLambda",
  actions: [
    "lambda:InvokeFunction",
  ],
  resources: ["*"],
}));

// Add write permissions for the inference lambda
runInferenceLambda.addToRolePolicy(new iam.PolicyStatement({
  sid: "AllowS3Access",
  actions: [
    "s3:PutObject",
    "s3:GetObject",
    "s3:ListBucket",
  ],
  resources: [
    `arn:aws:s3:::${PREDICTIONS_OUTPUT_BUCKET}`,
    `arn:aws:s3:::${PREDICTIONS_OUTPUT_BUCKET}/*`,
  ],
}));