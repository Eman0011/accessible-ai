import React, { createContext, useContext, useState } from 'react';
import { Organization, UserInfo } from '../types/models';

interface OrganizationContextType {
  currentOrganization: Organization | null;
  setCurrentOrganization: (org: Organization | null) => void;
  userRole: string | null;
  checkPermission: (permission: string) => boolean;
}

const OrganizationContext = createContext<OrganizationContextType>({
  currentOrganization: null,
  setCurrentOrganization: () => {},
  userRole: null,
  checkPermission: () => false,
});

export const OrganizationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  const checkPermission = (permission: string): boolean => {
    // Implement permission checking logic here
    // This could check against a list of permissions for the user's role
    return true;
  };

  return (
    <OrganizationContext.Provider 
      value={{ 
        currentOrganization, 
        setCurrentOrganization,
        userRole,
        checkPermission
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
};

export const useOrganization = () => useContext(OrganizationContext); 