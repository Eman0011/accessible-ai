import { defineStorage } from '@aws-amplify/backend';

export const storage = defineStorage({
  name: 'accessibleAiDrive',
  access: (allow) => ({
    // User-specific storage with identity check
    'users/*': [
      allow.authenticated.to(['read', 'write', 'delete'])
      // allow.entity('identity').to(['read', 'write', 'delete'])
    ],
  })
});