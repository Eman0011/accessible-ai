import { createAIHooks } from "@aws-amplify/ui-react-ai";
import { generateClient } from "aws-amplify/api";
import { Schema } from "../../../../amplify/data/resource";

export const client = generateClient<Schema>();
export const { useAIConversation, useAIGeneration } = createAIHooks(client);