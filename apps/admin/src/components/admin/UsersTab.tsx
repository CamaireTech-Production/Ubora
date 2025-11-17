import React from 'react';
// Note: UsersTable component removed - using local implementation
import { AdminService } from '../../services/admin/adminService';
import { AdminUser } from '@ubora/shared/types';

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
      <div className="space-y-4">
        {users.length === 0 ? (
          <div className="text-center py-8 text-gray-500">Aucun utilisateur trouvé</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nom</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rôle</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((user) => (
                  <tr key={user.id}>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{user.name}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{user.email}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{user.role}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{user.status || 'Active'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
