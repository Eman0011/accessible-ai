import { ECS } from 'aws-sdk';
import {
  ECS_CLUSTER,
  ECS_TASK_DEFINITION,
  PUBLIC_VPC_SUBNET_1,
  PUBLIC_VPC_SUBNET_2,
  TRAINING_CONTAINER,
  TRAINING_OUTPUT_BUCKET
} from '../../../Config';
import type { Schema } from '../../data/resource';

export const handler: Schema["runTrainingJob"]["functionHandler"] = async (event) => {
  // arguments typed from `.arguments()`
  const { fileUrl, targetFeature, submittedBy } = event.arguments

  const ecs = new ECS();

  const params = {
    cluster: ECS_CLUSTER, 
    taskDefinition: ECS_TASK_DEFINITION,
    count: 1,
    launchType: 'FARGATE',
    networkConfiguration: {
      awsvpcConfiguration: {
        subnets: [PUBLIC_VPC_SUBNET_1, PUBLIC_VPC_SUBNET_2],
        assignPublicIp: 'ENABLED',
      },
    },
    overrides: {
      containerOverrides: [
        {
          name: TRAINING_CONTAINER,
          environment: [
            { name: 'BUCKET', value: TRAINING_OUTPUT_BUCKET },
            { name: 'FILE', value: fileUrl || '' },
            { name: 'TARGET', value: targetFeature || ''},
            { name: 'USER', value: submittedBy || ''},
          ],
        },
      ],
    },
  };

  try {
    const runTask = await ecs.runTask(params).promise();
    const taskId = runTask.tasks?.[0]?.taskArn?.split('/')?.pop();

    return {
      fileUrl,
      targetFeature,
      submittedBy,
      taskId,
      status: 'PENDING',
    };
  } catch (error) {
    console.error(error);
    throw new Error('Failed to start ECS task');
  }
}