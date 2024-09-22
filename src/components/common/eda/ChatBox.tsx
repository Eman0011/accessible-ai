import React, { useState } from 'react';
import { SpaceBetween, Input, Button, Box } from '@cloudscape-design/components';

const ChatBox: React.FC = () => {
  const [message, setMessage] = useState('');

  const handleSendMessage = () => {
    // This function will be implemented later when we enable the chat
    console.log('Message sent:', message);
    setMessage('');
  };

  return (
    <Box padding="s">
      <SpaceBetween direction="vertical" size="s">
        <div style={{ height: '200px', overflowY: 'auto', border: '1px solid #ccc', padding: '10px' }}>
          {/* Chat messages will be displayed here */}
          <p><strong>EDA:</strong> Hello! I'm currently disabled, but I'll be here to help you soon!</p>
        </div>
        <SpaceBetween direction="horizontal" size="s">
          <Input
            value={message}
            onChange={({ detail }) => setMessage(detail.value)}
            placeholder="Type your message here..."
            disabled={true}
          />
          <Button onClick={handleSendMessage} disabled={true}>Send</Button>
        </SpaceBetween>
      </SpaceBetween>
    </Box>
  );
};

export default ChatBox;