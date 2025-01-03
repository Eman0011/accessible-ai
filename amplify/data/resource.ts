import { type ClientSchema, a, defineData } from "@aws-amplify/backend";
import { runModelInference } from "../functions/run-inference/resource";
import { runTrainingJob } from "../functions/run-training/resource";
import { EDA_MODEL_NAME, EDA_MODEL_VERSION_REPORT_SYSTEM_PROMPT, EDA_SYSTEM_PROMPT } from "./constants";

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
      predictions: a.hasMany('Prediction', 'projectId'),
      exploratoryAnalyses: a.hasMany('ExploratoryAnalysis', 'projectId'),
      reports: a.hasMany('Report', 'projectId'),
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
      report: a.string(),
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
      predictions: a.hasMany('Prediction', 'modelVersionId'),
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

  // Prediction Entity (replacing Inference)
  Prediction: a
    .model({
      id: a.id(),
      modelVersionId: a.string().required(),
      projectId: a.string().required(),
      type: a.string().required(), // 'ADHOC' | 'BATCH'
      status: a.string().required(), // 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED'
      submittedBy: a.string().required(),
      
      // Input data - store as stringified JSON
      adhocInput: a.string(),
      inputDataPath: a.string(),
      
      // Output data - store as stringified JSON
      adhocOutput: a.string(),
      outputDataPath: a.string(),
      
      // Performance metrics - store as stringified JSON
      inferenceLatency: a.integer(),
      computeResources: a.string(),
      environmentDetails: a.string(),
      error: a.string(),
      
      // Timestamps
      startTime: a.datetime(),
      endTime: a.datetime(),
      createdAt: a.datetime(),
      updatedAt: a.datetime(),
      
      // Relationships
      modelVersion: a.belongsTo('ModelVersion', 'modelVersionId'),
      project: a.belongsTo('Project', 'projectId'),
    })
    .secondaryIndexes((index) => [
      index('modelVersionId').sortKeys(['createdAt']),
      index('projectId').sortKeys(['createdAt']),
      index('submittedBy').sortKeys(['createdAt']),
      index('type').sortKeys(['createdAt']),
      index('status').sortKeys(['createdAt']),
    ])
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

    // Organization Entity
  Organization: a
  .model({
    id: a.id(),
    name: a.string().required(),
    owner: a.string().required(),
    users: a.hasMany('User', 'organizationId'),
    createdAt: a.datetime(),
    updatedAt: a.datetime(),
    projects: a.hasMany('Project', 'organizationId'),
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
      role: a.string().required(),
      createdAt: a.datetime(),
      updatedAt: a.datetime(),
    })
    .authorization((allow) => [allow.authenticated()]),

  // OrganizationInvite Entity
  OrganizationInvite: a
    .model({
      id: a.id(),
      organizationId: a.string().required(),
      email: a.string().required(),
      status: a.string().required(),
      createdAt: a.datetime(),
      updatedAt: a.datetime(),
    })
    .authorization((allow) => [allow.authenticated()]),

  // runTrainingJob Query
  runTrainingJob: a
    .query()
    .arguments({
      fileUrl: a.string().required(),
      targetFeature: a.string().required(),
      submittedBy: a.string().required(),
      basePath: a.string().required(),
      modelVersionId: a.string().required(),
      trainingConfig: a.json(),
    })
    .returns(a.json())
    .handler(a.handler.function(runTrainingJob))
    .authorization((allow) => [allow.authenticated()]),

  // runModelInference Query
  runModelInference: a
    .query()
    .arguments({
      predictionId: a.string().required(),
      modelVersionId: a.string().required(),
      targetFeature: a.string().required(),
      basePath: a.string().required(),
      submittedBy: a.string().required(),
      input: a.json(),
      inputDataPath: a.string(),
      outputDataPath: a.string(),
    })
    .returns(a.json())
    .handler(a.handler.function(runModelInference))
    .authorization((allow) => [allow.authenticated()]),

  // EDA Chat
  chat: a
    .conversation({
      aiModel: a.ai.model(EDA_MODEL_NAME),
      systemPrompt: EDA_SYSTEM_PROMPT,
      tools: [
        a.ai.dataTool({
          name: 'listModels',
          description: 'Get models (id, name, description, owner, projectId)',
          model: a.ref('Model'),
          modelOperation: 'list'
        }),
        a.ai.dataTool({
          name: 'listModelVersions',
          description: 'Get model versions (id, modelId, version, status, targetFeature, report)',
          model: a.ref('ModelVersion'),
          modelOperation: 'list'
        }),
        a.ai.dataTool({
          name: 'listDatasets',
          description: 'Get datasets (id, name, description, owner, projectId,)',
          model: a.ref('Dataset'),
          modelOperation: 'list'
        }),
        a.ai.dataTool({
          name: 'listDatasetVersions',
          description: 'Get dataset versions (id, datasetId, version, size, rowCount)',
          model: a.ref('DatasetVersion'),
          modelOperation: 'list'
        })
      ]
    })
    .authorization((allow) => allow.owner()),

  // Generate Model Version Report
  generateModelVersionReport: a
    .generation({
      aiModel: a.ai.model(EDA_MODEL_NAME),
      systemPrompt: EDA_MODEL_VERSION_REPORT_SYSTEM_PROMPT
    })
    .arguments({
      modelName: a.string().required(),
      modelDescription: a.string().required(),
      modelPipeline: a.json().required(),
      performanceMetrics: a.json().required(),
      featureNames: a.json().required(),
      datasetName: a.string().required(),
      datasetDescription: a.string().required(),
      datasetRows: a.integer().required(),
      datasetSize: a.integer().required(),
      targetFeature: a.string().required()
    })
    .returns(a.json())
    .authorization((allow) => allow.authenticated()),

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
