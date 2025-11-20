import { useState, useCallback } from 'react';

export interface ChatFilters {
  period: string;
  formId: string;
  userId: string;
}

interface UseChatFiltersReturn {
  filters: ChatFilters;
  setFilters: (filters: ChatFilters) => void;
  selectedFormat: string | null;
  selectedFormats: string[];
  selectedFormIds: string[];
  setSelectedFormat: (format: string | null) => void;
  setSelectedFormats: (formats: string[]) => void;
  setSelectedFormIds: (formIds: string[]) => void;
  handleFormatChange: (format: string | null) => void;
  handleFormatsChange: (formats: string[]) => void;
  handleFormSelectionChange: (formIds: string[]) => void;
}

export const useChatFilters = (): UseChatFiltersReturn => {
  const [filters, setFilters] = useState<ChatFilters>({
    period: 'all',
    formId: '',
    userId: ''
  });

  const [selectedFormat, setSelectedFormat] = useState<string | null>(null);
  const [selectedFormats, setSelectedFormats] = useState<string[]>([]);
  const [selectedFormIds, setSelectedFormIds] = useState<string[]>([]);

  const handleFormatChange = useCallback((format: string | null) => {
    setSelectedFormat(format);
    // Clear multi-format when using single format
    if (format) {
      setSelectedFormats([]);
    }
  }, []);

  const handleFormatsChange = useCallback((formats: string[]) => {
    setSelectedFormats(formats);
    // Clear single format when using multi-format
    if (formats.length > 0) {
      setSelectedFormat(null);
    }
  }, []);

  const handleFormSelectionChange = useCallback((formIds: string[]) => {
    setSelectedFormIds(formIds);
  }, []);

  return {
    filters,
    setFilters,
    selectedFormat,
    selectedFormats,
    selectedFormIds,
    setSelectedFormat,
    setSelectedFormats,
    setSelectedFormIds,
    handleFormatChange,
    handleFormatsChange,
    handleFormSelectionChange
  };
};

