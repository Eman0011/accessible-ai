import { fetchAuthSession, getCurrentUser } from 'aws-amplify/auth';
import { AwsCredentialIdentity } from '@aws-sdk/types';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { UserInfo, UserRole } from '../types/models';

interface User {
  id: string;
  username: string;
  email: string;
  organizationId: string;
  role: UserRole;
  title?: string;
  level?: string;
  signInDetails?: any;
}

interface UserContextType {
  user: User | null;
  userInfo: UserInfo | null;
  credentials: AwsCredentialIdentity | null;
  setUserInfo: (userInfo: UserInfo | null) => void;
  isLoading: boolean;
  error: Error | null;
}

const UserContext = createContext<UserContextType>({
  user: null,
  userInfo: null,
  credentials: null,
  setUserInfo: () => {},
  isLoading: true,
  error: null
});

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [credentials, setCredentials] = useState<AwsCredentialIdentity | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;

    const initializeUser = async () => {
      try {
        const authUser = await getCurrentUser();
        
        if (isMounted) {
          const newUser: User = {
            id: authUser.userId,
            username: authUser.username,
            email: authUser.signInDetails?.loginId || '',
            organizationId: 'default',
            role: 'member',
            title: '',
            level: 'junior',
            signInDetails: authUser.signInDetails
          };
          setUser(newUser);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          console.error('Error fetching user:', err);
          setError(err instanceof Error ? err : new Error('Failed to fetch user'));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    initializeUser();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const { credentials } = await fetchAuthSession();
        setCredentials(credentials || null);
      } catch (error) {
        console.error('Error loading user session:', error);
      }
    };
    loadUser();
  }, []);

  const value = {
    user,
    userInfo,
    credentials,
    setUserInfo,
    isLoading,
    error
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};