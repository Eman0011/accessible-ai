import { type ClientSchema, a, defineData } from "@aws-amplify/backend";
import { runModelInference } from "../functions/run-inference/resource";
import { runTrainingJob } from "../functions/run-training/resource";

/*== STEP 1 ===============================================================
The section below creates a Todo database table with a "content" field. Try
adding a new "isDone" field as a boolean. The authorization rule below
specifies that any user authenticated via an API key can "create", "read",
"update", and "delete" any "Todo" records.
=========================================================================*/

const schema = a.schema({
  // Project Entity
  Project: a
    .model({
      id: a.id(),
      name: a.string().required(),
      owner: a.string().required(),
      description: a.string(),
      createdAt: a.datetime(),
      updatedAt: a.datetime(),
      models: a.hasMany('Model', 'projectId'),
      datasets: a.hasMany('Dataset', 'projectId'),
      exploratoryAnalyses: a.hasMany('ExploratoryAnalysis', 'projectId'),
      reports: a.hasMany('Report', 'projectId'),
      inferences: a.hasMany('Inference', 'projectId'),
      projectMembers: a.hasMany('ProjectMember', 'projectId'),
      organizationId: a.string().required(),
      organization: a.belongsTo('Organization', 'organizationId'),
    })
    .secondaryIndexes((index) => [index('owner').sortKeys(['createdAt'])])
    .authorization((allow) => [
      allow.authenticated().to(['create', 'read', 'update', 'delete']),
    ]),

  // ProjectMember Entity
  ProjectMember: a
    .model({
      id: a.id(),
      projectId: a.string().required(),
      userId: a.string().required(),
      role: a.string().required(),
      project: a.belongsTo('Project', 'projectId'),
    })
    .secondaryIndexes((index) => [
      index('projectId').sortKeys(['role']),
      index('userId').sortKeys(['projectId']),
    ])
    .authorization((allow) => [allow.authenticated()]),

  // Dataset Entity
  Dataset: a
    .model({
      id: a.id(),
      projectId: a.string().required(),
      name: a.string().required(),
      description: a.string().required(),
      owner: a.string().required(),
      ownerId: a.string().required(),
      createdAt: a.datetime(),
      updatedAt: a.datetime(),
      project: a.belongsTo('Project', 'projectId'),
      datasetVersions: a.hasMany('DatasetVersion', 'datasetId'),
      exploratoryAnalysis: a.hasOne('ExploratoryAnalysis', 'datasetId'),
    })
    .secondaryIndexes((index) => [
      index('name').sortKeys(['createdAt']),
      index('owner').sortKeys(['createdAt']),
    ])
    .authorization((allow) => [allow.authenticated()]),

  // DatasetVersion Entity
  DatasetVersion: a
    .model({
      id: a.id(),
      datasetId: a.string().required(),
      version: a.integer().required(),
      s3Key: a.string().required(),
      uploadDate: a.datetime().required(),
      size: a.integer().required(),
      rowCount: a.integer().required(),
      createdAt: a.datetime(),
      updatedAt: a.datetime(),
      dataset: a.belongsTo('Dataset', 'datasetId'),
      models: a.hasMany('ModelVersion', 'datasetVersionId'),
    })
    .secondaryIndexes((index) => [
      index('datasetId').sortKeys(['version']),
    ])
    .authorization((allow) => [allow.authenticated()]),

  // Model Entity
  Model: a
    .model({
      id: a.id(),
      name: a.string().required(),
      description: a.string().required(),
      owner: a.string().required(),
      createdAt: a.datetime(),
      updatedAt: a.datetime(),
      projectId: a.id().required(),
      project: a.belongsTo('Project', 'projectId'),
      modelVersions: a.hasMany('ModelVersion', 'modelId'),
    })
    .secondaryIndexes((index) => [
      index('name').sortKeys(['createdAt']),
      index('owner').sortKeys(['createdAt']),
    ])
    .authorization((allow) => [allow.authenticated()]),

  // ModelVersion Entity
  ModelVersion: a
    .model({
      id: a.id(),
      modelId: a.string().required(),
      version: a.integer().required(),
      status: a.string().required(),
      targetFeature: a.string().required(),
      fileUrl: a.string().required(),
      s3OutputPath: a.string().required(),
      datasetVersionId: a.id().required(),
      trainingJobId: a.string(),
      performanceMetrics: a.json(),
      trainingConfig: a.json(),
      trainingResources: a.json(),
      environmentDetails: a.json(),
      trainingTime: a.integer(),
      createdAt: a.datetime(),
      updatedAt: a.datetime(),
      model: a.belongsTo('Model', 'modelId'),
      datasetVersion: a.belongsTo('DatasetVersion', 'datasetVersionId'),
      modelPerformances: a.hasMany('ModelPerformance', 'modelVersionId'),
      inferences: a.hasMany('Inference', 'modelVersionId')
    })
    .secondaryIndexes((index) => [
      index('modelId').sortKeys(['version']),
      index('status').sortKeys(['createdAt']),
    ])
    .authorization((allow) => [allow.authenticated()]),

  // ExploratoryAnalysis Entity
  ExploratoryAnalysis: a
    .model({
      id: a.id(),
      datasetId: a.string().required(),
      projectId: a.string().required(),
      createdBy: a.string().required(),
      analysisResults: a.json(),
      analysisTime: a.integer(),
      createdAt: a.datetime(),
      updatedAt: a.datetime(),
      project: a.belongsTo('Project', 'projectId'),
      dataset: a.belongsTo('Dataset', 'datasetId'),
    })
    .authorization((allow) => [allow.authenticated()]),

  // Inference Entity
  Inference: a
    .model({
      id: a.id(),
      projectId: a.string().required(),
      modelVersionId: a.string().required(),
      inputDataPath: a.string(),
      outputDataPath: a.string(),
      inferenceTimestamp: a.datetime().required(),
      inferenceLatency: a.integer(),
      computeResources: a.json(),
      environmentDetails: a.json(),
      createdAt: a.datetime(),
      updatedAt: a.datetime(),
      modelVersion: a.belongsTo('ModelVersion', 'modelVersionId'),
      project: a.belongsTo('Project', 'projectId'),
    })
    .authorization((allow) => [allow.authenticated()]),

  // ModelPerformance Entity
  ModelPerformance: a
    .model({
      id: a.id(),
      modelVersionId: a.string().required(),
      metrics: a.json().required(),
      evaluatedAt: a.datetime().required(),
      modelVersion: a.belongsTo('ModelVersion', 'modelVersionId'),
    })
    .secondaryIndexes((index) => [index('modelVersionId').sortKeys(['evaluatedAt'])])
    .authorization((allow) => [allow.authenticated()]),

  // Report Entity
  Report: a
    .model({
      id: a.id(),
      projectId: a.string().required(),
      createdBy: a.string().required(),
      reportData: a.json().required(),
      createdAt: a.datetime(),
      updatedAt: a.datetime(),
      project: a.belongsTo('Project', 'projectId'),
    })
    .authorization((allow) => [allow.authenticated()]),

  // AuditLog Entity
  AuditLog: a
    .model({
      id: a.id(),
      userId: a.string().required(),
      action: a.string().required(),
      details: a.json(),
      timestamp: a.datetime().required(),
    })
    .secondaryIndexes((index) => [
      index('userId').sortKeys(['timestamp']),
      index('action').sortKeys(['timestamp']),
    ])
    .authorization((allow) => [allow.authenticated()]),

  // runTrainingJob Query
  runTrainingJob: a
    .query()
    .arguments({
      fileUrl: a.string(),
      targetFeature: a.string(),
      submittedBy: a.string(),
      modelVersionId: a.string(),
      projectId: a.string(),
      outputPath: a.string(),
      trainingConfig: a.json(),
    })
    .returns(a.json())
    .handler(a.handler.function(runTrainingJob))
    .authorization((allow) => [allow.authenticated()]),

  // runModelInference Query
  runModelInference: a
    .query()
    .arguments({
      modelPath: a.string(),
      input: a.json(),
      inputDataPath: a.string(),
      outputDataPath: a.string(),
      modelVersionId: a.string(),
    })
    .returns(a.json())
    .handler(a.handler.function(runModelInference))
    .authorization((allow) => [allow.authenticated()]),

  // Organization Entity
  Organization: a
    .model({
      id: a.id(),
      name: a.string().required(),
      description: a.string(),
      createdAt: a.datetime(),
      updatedAt: a.datetime(),
      users: a.hasMany('User', 'organizationId'),
      projects: a.hasMany('Project', 'organizationId'),
      oranizationInvites: a.hasMany('OrganizationInvite', 'organizationId')
    })
    .authorization((allow) => [allow.authenticated()]),

  // User Entity
  User: a
    .model({
      id: a.id(),
      username: a.string().required(),
      email: a.string().required(),
      organizationId: a.string().required(),
      organization: a.belongsTo('Organization', 'organizationId'),
      role: a.string().required(), // 'admin' | 'member'
      title: a.string(),
      level: a.string(), // 'junior' | 'senior' | 'manager'
      phoneNumber: a.string(),
      createdAt: a.datetime(),
      updatedAt: a.datetime(),
    })
    .authorization((allow) => [allow.authenticated()]),

  // OrganizationInvite Entity
  OrganizationInvite: a
    .model({
      id: a.id(),
      organizationId: a.string().required(),
      organization: a.belongsTo('Organization', 'organizationId'),
      email: a.string().required(),
      status: a.string().required(), // 'pending' | 'accepted' | 'rejected'
      invitedBy: a.string().required(),
      expiresAt: a.datetime().required(),
      createdAt: a.datetime(),
      updatedAt: a.datetime(),
    })
    .authorization((allow) => [allow.authenticated()]),

  // Add impersonation query
  // impersonateUser: a
  //   .query()
  //   .arguments({
  //     userId: a.string().required(),
  //     adminId: a.string().required(),
  //   })
  //   .returns(a.string())
  //   .authorization((allow) => [
  //     allow.authenticated(),
  //   ]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
    // API Key is used for a.allow.public() rules
    apiKeyAuthorizationMode: {
      expiresInDays: 30,
    },
  },
});


/*== STEP 2 ===============================================================
Go to your frontend source code. From your client-side code, generate a
Data client to make CRUDL requests to your table. (THIS SNIPPET WILL ONLY
WORK IN THE FRONTEND CODE FILE.)

Using JavaScript or Next.js React Server Components, Middleware, Server 
Actions or Pages Router? Review how to generate Data clients for those use
cases: https://docs.amplify.aws/gen2/build-a-backend/data/connect-to-API/
=========================================================================*/

/*
"use client"
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";

const client = generateClient<Schema>() // use this Data client for CRUDL requests
*/

/*== STEP 3 ===============================================================
Fetch records from the database and use them in your frontend component.
(THIS SNIPPET WILL ONLY WORK IN THE FRONTEND CODE FILE.)
=========================================================================*/

/* For example, in a React component, you can use this snippet in your
  function's RETURN statement */
// const { data: todos } = await client.models.Todo.list()

// return <ul>{todos.map(todo => <li key={todo.id}>{todo.content}</li>)}</ul>
