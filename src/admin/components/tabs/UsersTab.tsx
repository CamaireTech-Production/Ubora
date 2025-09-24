import React from 'react';
import { UsersTable } from '../../../components/UsersTable';
import { AdminService } from '../../services/adminService';
import { AdminUser } from '../../types';

interface UsersTabProps {
  onRefresh: () => void;
}

export const UsersTab: React.FC<UsersTabProps> = ({ onRefresh }) => {
  const [users, setUsers] = React.useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const usersData = await AdminService.getAllUsersWithDetails();
      setUsers(usersData);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = () => {
    loadUsers();
    onRefresh();
  };

  if (isLoading) {
    return (
      <div className="text-center py-12 text-gray-500">
        Chargement des utilisateurs...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-lg font-semibold text-gray-900">Gestion des utilisateurs</h2>
      </div>
      <UsersTable users={users} onRefresh={handleRefresh} />
    </div>
  );
};
