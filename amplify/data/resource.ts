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
    })
    .secondaryIndexes((index) => [
      index("owner").sortKeys(['createdAt'])
    ])
    .authorization((allow) => [allow.authenticated()]),

  Dataset: a
    .model({
      id: a.id(),
      projectId: a.string().required(),
      name: a.string().required(),
      version: a.integer().required(),
      description: a.string().required(),
      owner: a.string().required(),
      s3Key: a.string().required(),
      uploadDate: a.datetime().required(),
      size: a.integer().required(),
      rowCount: a.integer().required(),
      project: a.belongsTo('Project', 'projectId'),
      models: a.hasMany('Model', 'datasetId'),
    })
    .secondaryIndexes((index) => [
      index("name").sortKeys(["version"]),
      index("owner").sortKeys(["version"])
    ])
    .authorization((allow) => [allow.authenticated()]),

  Model: a
    .model({
      id: a.id(),
      name: a.string().required(),
      description: a.string().required(),
      owner: a.string().required(),
      version: a.integer().required(),
      status: a.string().required(),
      targetFeature: a.string(),
      fileUrl: a.string().required(),
      s3Key: a.string(),
      trainingJobId: a.string(),
      performanceMetrics: a.json(),
      createdAt: a.datetime(),
      updatedAt: a.datetime(),
      projectId: a.id().required(),
      project: a.belongsTo('Project', 'projectId'),
      datasetId: a.id().required(),
      dataset: a.belongsTo('Dataset', 'datasetId'),
    })
    .secondaryIndexes((index) => [
      index("name").sortKeys(["version"]),
      index("owner").sortKeys(['version'])
    ])
    .authorization((allow) => [allow.authenticated()]),

  runTrainingJob: a
    .query()
    .arguments({
      fileUrl: a.string(),
      targetFeature: a.string(),
      submittedBy: a.string(),
      modelId: a.string(),
    })
    .returns(a.json())
    .handler(a.handler.function(runTrainingJob))
    .authorization((allow) => [allow.authenticated()]),

  runModelInference: a
    .query()
    .arguments({
      modelPath: a.string(),
      input: a.json()
    })
    .returns(a.json())
    .handler(a.handler.function(runModelInference))
    .authorization((allow) => [allow.authenticated()]),
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
