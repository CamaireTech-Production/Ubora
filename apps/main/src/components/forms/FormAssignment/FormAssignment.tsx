import React from 'react';

interface Employee {
  id: string;
  name: string;
  email: string;
}

interface FormAssignmentProps {
  assignedTo: string[];
  employees: Employee[];
  currentUser?: { id: string; name: string; email: string; role: string };
  onToggleAssignment: (employeeId: string) => void;
  isEditMode?: boolean;
  error?: string;
}

export const FormAssignment: React.FC<FormAssignmentProps> = ({
  assignedTo,
  employees,
  currentUser,
  onToggleAssignment,
  isEditMode = false,
  error
}) => {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-3">
        Assigner aux utilisateurs *
      </label>
      <div className="space-y-2 max-h-32 sm:max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-3">
        {/* Show director option first if current user is a director */}
        {currentUser?.role === 'directeur' && (
          <label className="flex items-start space-x-3 cursor-pointer hover:bg-gray-50 p-2 rounded bg-blue-50 border border-blue-200">
            <input
              type="checkbox"
              checked={assignedTo.includes(currentUser.id)}
              onChange={() => onToggleAssignment(currentUser.id)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mt-0.5"
            />
            <div className="flex-1">
              <span className="text-sm font-medium text-blue-900 break-words">Moi ({currentUser.name})</span>
              <span className="text-xs text-blue-600 block sm:inline sm:ml-2 break-all">({currentUser.email})</span>
            </div>
          </label>
        )}
        
        {/* Show employees */}
        {employees.length === 0 ? (
          <p className="text-gray-500 text-sm">Aucun employé disponible</p>
        ) : (
          employees.map(employee => (
            <label key={employee.id} className="flex items-start space-x-3 cursor-pointer hover:bg-gray-50 p-2 rounded">
              <input
                type="checkbox"
                checked={assignedTo.includes(employee.id)}
                onChange={() => onToggleAssignment(employee.id)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mt-0.5"
              />
              <div className="flex-1">
                <span className="text-sm font-medium text-gray-900 break-words">{employee.name}</span>
                <span className="text-xs text-gray-500 block sm:inline sm:ml-2 break-all">({employee.email})</span>
              </div>
            </label>
          ))
        )}
      </div>
      {error && (
        <p className="text-sm text-red-600 mt-1">{error}</p>
      )}
      {assignedTo.length === 0 && !error && (
        <p className="text-sm text-red-600 mt-1">Veuillez sélectionner au moins un employé</p>
      )}
      {isEditMode && (
        <p className="text-xs text-blue-600 mt-1">
          💡 Vous pouvez modifier les employés assignés même après la création du formulaire
        </p>
      )}
    </div>
  );
};

