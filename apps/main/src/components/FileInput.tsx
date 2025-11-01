import React, { useRef } from 'react';
import { Upload, File, X, Loader2 } from 'lucide-react';

interface UploadProgress {
  fieldId: string;
  fileName: string;
  progress: number;
  status: 'uploading' | 'extracting' | 'completed' | 'error';
  error?: string;
}

interface FileInputProps {
  label: string;
  value?: File | null;
  onChange: (file: File | null) => void;
  placeholder?: string;
  error?: string;
  required?: boolean;
  acceptedTypes?: string[];
  className?: string;
  progress?: UploadProgress;
}

export const FileInput: React.FC<FileInputProps> = ({
  label,
  value,
  onChange,
  placeholder,
  error,
  required = false,
  acceptedTypes = [],
  className = "",
  progress
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    onChange(file);
  };

  const handleRemoveFile = () => {
    onChange(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <label className="block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      
      <div className="relative">
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptedTypes.join(',')}
          onChange={handleFileChange}
          className="hidden"
        />
        
        {progress && progress.status !== 'completed' ? (
          // Show loading animation during upload/extraction
          <div className="w-full p-4 border-2 border-dashed border-yellow-300 rounded-lg bg-yellow-50">
            <div className="flex flex-col items-center space-y-3">
              <Loader2 className="h-8 w-8 text-yellow-600 animate-spin" />
              <div className="text-center">
                <p className="text-sm font-medium text-yellow-800">
                  {progress.status === 'uploading' ? 'Téléchargement en cours...' : 'Analyse du PDF en cours...'}
                </p>
                <p className="text-xs text-yellow-600 mt-1">
                  {progress.fileName}
                </p>
                {progress.status === 'uploading' && progress.progress > 0 && (
                  <p className="text-xs text-yellow-600 mt-1">
                    {progress.progress}%
                  </p>
                )}
                {progress.status === 'extracting' && (
                  <div className="flex items-center justify-center mt-2">
                    <Loader2 className="h-4 w-4 animate-spin mr-2 text-yellow-600" />
                    <span className="text-xs text-yellow-600">Extraction du texte...</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : !value ? (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <div className="flex flex-col items-center space-y-2">
              <Upload className="h-8 w-8 text-gray-400" />
              <div className="text-sm text-gray-600">
                <span className="font-medium text-blue-600 hover:text-blue-500">
                  Cliquez pour sélectionner un fichier
                </span>
                <p className="text-gray-500 mt-1">
                  {placeholder || 'ou glissez-déposez ici'}
                </p>
                {acceptedTypes.length > 0 && (
                  <p className="text-xs text-gray-400 mt-1">
                    Types acceptés: {acceptedTypes.join(', ')}
                  </p>
                )}
              </div>
            </div>
          </button>
        ) : (
          <div className="w-full p-4 border border-gray-300 rounded-lg bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <File className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-sm font-medium text-gray-900">{value.name}</p>
                  <p className="text-xs text-gray-500">{formatFileSize(value.size)}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRemoveFile}
                className="p-1 text-gray-400 hover:text-red-500 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
      
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  );
};
