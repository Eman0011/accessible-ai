import { defineFunction } from '@aws-amplify/backend';

export const runModelInference = defineFunction({
  name: 'run-inference',
  entry: './handler.ts',
});