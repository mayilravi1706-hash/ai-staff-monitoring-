import React from 'react';
import { UnifiedAppLayout } from './UnifiedAppLayout';

interface AdminLayoutProps {
  children: React.ReactNode;
  breadcrumbs?: { label: string; href?: string }[];
  searchPlaceholder?: string;
  onSearch?: (query: string) => void;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  children,
  breadcrumbs,
  searchPlaceholder,
  onSearch,
}) => {
  return (
    <UnifiedAppLayout
      breadcrumbs={breadcrumbs}
      searchPlaceholder={searchPlaceholder}
      onSearch={onSearch}
    >
      {children}
    </UnifiedAppLayout>
  );
};
