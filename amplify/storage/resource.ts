import { defineStorage } from '@aws-amplify/backend';

export const storage = defineStorage({
  name: 'accessibleAiDrive',
  access: (allow) => ({
    'training-data/{entity_id}/*': [
      allow.guest.to(['read']),
      allow.entity('identity').to(['read', 'write', 'delete'])
    ],
    'example-training-data/*': [
      allow.authenticated.to(['read','write']),
      allow.guest.to(['read', 'write'])
    ],
    'projects/*': [
      allow.authenticated.to(['read', 'write', 'delete'])
    ],
  })
});