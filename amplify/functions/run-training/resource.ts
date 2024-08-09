import { defineFunction } from '@aws-amplify/backend';

export const runTrainingJob = defineFunction({
  name: 'run-training',
  entry: './handler.ts',
});