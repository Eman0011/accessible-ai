import { View } from "@aws-amplify/ui-react";
import { AIConversation } from "@aws-amplify/ui-react-ai";
import { useAIConversation } from "./client";

import React from 'react';

const ChatBox: React.FC = () => {
  const [
    {
      data: { messages },
      isLoading,
    },
    sendMessage,
  ] = useAIConversation('chat');

  return (
      <View padding="large" flex="1">
        <AIConversation
          welcomeMessage="Hi, I'm EDA! I'm here to help you with your data analysis and machine learning tasks."
          messages={messages}
          isLoading={isLoading}
          handleSendMessage={sendMessage}
        />
      </View>
  );
};

export default ChatBox;