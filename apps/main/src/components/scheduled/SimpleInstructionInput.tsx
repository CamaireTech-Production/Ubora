import React from 'react';

interface SimpleInstructionInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  maxLength?: number;
}

export const SimpleInstructionInput: React.FC<SimpleInstructionInputProps> = ({
  value,
  onChange,
  placeholder = "Écrivez votre instruction pour ARCHA...",
  disabled = false,
  maxLength = 2000
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  const isNearLimit = value.length > maxLength * 0.8;

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        Instruction *
      </label>
      
      <div className="relative">
        <textarea
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          disabled={disabled}
          maxLength={maxLength}
          className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
          rows={4}
        />
        
        {/* Character counter */}
        {isNearLimit && (
          <div className="absolute bottom-2 right-2 text-xs">
            <span className={`${value.length >= maxLength ? 'text-red-500' : 'text-yellow-600'}`}>
              {value.length}/{maxLength}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
