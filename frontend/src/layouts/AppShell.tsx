import React from 'react';
import { UnifiedAppLayout } from './UnifiedAppLayout';

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  return <UnifiedAppLayout>{children}</UnifiedAppLayout>;
};
