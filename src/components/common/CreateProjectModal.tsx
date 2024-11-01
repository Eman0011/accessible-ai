import React, { useState } from 'react';
import { Modal, Form, FormField, Input, Button, SpaceBetween } from '@cloudscape-design/components';
import { useNavigate } from 'react-router-dom';

interface CreateProjectModalProps {
  visible: boolean;
  onClose: () => void;
  onCreateProject: (projectName: string, description: string) => Promise<any>;
}

const CreateProjectModal: React.FC<CreateProjectModalProps> = ({ visible, onClose, onCreateProject }) => {
  const [projectName, setProjectName] = useState('');
  const [description, setDescription] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async () => {
    const newProject = await onCreateProject(projectName, description);
    if (newProject) {
      setProjectName('');
      setDescription('');
      onClose();
      navigate('/');
    }
  };

  return (
    <Modal visible={visible} onDismiss={onClose} header="Create New Project">
      <Form
        actions={
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={onClose}>Cancel</Button>
            <Button variant="primary" onClick={handleSubmit}>Create Project</Button>
          </SpaceBetween>
        }
      >
        <FormField label="Project Name">
          <Input
            value={projectName}
            onChange={({ detail }) => setProjectName(detail.value)}
          />
        </FormField>
        <FormField label="Description">
          <Input
            value={description}
            onChange={({ detail }) => setDescription(detail.value)}
          />
        </FormField>
      </Form>
    </Modal>
  );
};

export default CreateProjectModal;