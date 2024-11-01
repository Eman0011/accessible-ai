import {
  Button,
  Container,
  Form,
  FormField,
  Header,
  Input,
  Modal,
  SpaceBetween,
  Table
} from '@cloudscape-design/components';
import { generateClient } from 'aws-amplify/api';
import React, { useEffect, useState } from 'react';
import { useUser } from '../../contexts/UserContext';
import { Organization, User } from '../../types/models';

const client = generateClient();

export const OrganizationManager: React.FC = () => {
  const { userInfo } = useUser();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userInfo?.organizationId) {
      fetchOrganizationDetails();
    }
  }, [userInfo]);

  const fetchOrganizationDetails = async () => {
    try {
      const { data: org } = await client.models.Organization.get({
        id: userInfo!.organizationId
      });
      setOrganization(org as Organization);

      const { data: orgUsers } = await client.models.User.list({
        filter: { organizationId: { eq: userInfo!.organizationId } }
      });
      setUsers(orgUsers as User[]);
    } catch (error) {
      console.error('Error fetching organization details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInviteUser = async () => {
    try {
      await client.models.OrganizationInvite.create({
        organizationId: organization!.id,
        email: inviteEmail,
        status: 'pending',
        invitedBy: userInfo!.userId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      });
      setShowInviteModal(false);
      setInviteEmail('');
    } catch (error) {
      console.error('Error inviting user:', error);
    }
  };

  return (
    <Container>
      <SpaceBetween size="l">
        <Header
          variant="h1"
          actions={
            <Button onClick={() => setShowInviteModal(true)}>
              Invite User
            </Button>
          }
        >
          Organization Management
        </Header>

        <Header variant="h2">Organization Details</Header>
        {organization && (
          <SpaceBetween size="m">
            <div>Name: {organization.name}</div>
            <div>Description: {organization.description}</div>
          </SpaceBetween>
        )}

        <Header variant="h2">Users</Header>
        <Table
          columnDefinitions={[
            { id: 'username', header: 'Username', cell: item => item.username },
            { id: 'email', header: 'Email', cell: item => item.email },
            { id: 'role', header: 'Role', cell: item => item.role },
            { id: 'title', header: 'Title', cell: item => item.title || '-' },
            { id: 'level', header: 'Level', cell: item => item.level || '-' },
          ]}
          items={users}
          loading={loading}
        />

        <Modal
          visible={showInviteModal}
          onDismiss={() => setShowInviteModal(false)}
          header="Invite User"
        >
          <Form
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button onClick={() => setShowInviteModal(false)}>Cancel</Button>
                <Button variant="primary" onClick={handleInviteUser}>
                  Send Invite
                </Button>
              </SpaceBetween>
            }
          >
            <FormField label="Email">
              <Input
                value={inviteEmail}
                onChange={({ detail }) => setInviteEmail(detail.value)}
                type="email"
              />
            </FormField>
          </Form>
        </Modal>
      </SpaceBetween>
    </Container>
  );
}; 