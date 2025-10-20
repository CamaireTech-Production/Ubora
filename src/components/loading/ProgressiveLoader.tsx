import React, { useState, useEffect } from 'react';
import { CheckCircle, Loader2, Clock } from 'lucide-react';

interface LoadingStep {
  id: string;
  label: string;
  status: 'pending' | 'loading' | 'completed' | 'error';
  error?: string;
}

interface ProgressiveLoaderProps {
  steps: LoadingStep[];
  onAllComplete?: () => void;
  className?: string;
}

export const ProgressiveLoader: React.FC<ProgressiveLoaderProps> = ({
  steps,
  onAllComplete,
  className = ""
}) => {
  const [currentSteps, setCurrentSteps] = useState<LoadingStep[]>(steps);

  useEffect(() => {
    setCurrentSteps(steps);
  }, [steps]);

  useEffect(() => {
    const allCompleted = currentSteps.every(step => step.status === 'completed');
    if (allCompleted && onAllComplete) {
      onAllComplete();
    }
  }, [currentSteps, onAllComplete]);

  const getStepIcon = (step: LoadingStep) => {
    switch (step.status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'loading':
        return <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />;
      case 'error':
        return <div className="h-5 w-5 rounded-full bg-red-600 flex items-center justify-center">
          <span className="text-white text-xs font-bold">!</span>
        </div>;
      default:
        return <Clock className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStepStatus = (step: LoadingStep) => {
    switch (step.status) {
      case 'completed':
        return 'text-green-600';
      case 'loading':
        return 'text-blue-600';
      case 'error':
        return 'text-red-600';
      default:
        return 'text-gray-500';
    }
  };

  const completedSteps = currentSteps.filter(step => step.status === 'completed').length;
  const totalSteps = currentSteps.length;
  const progressPercentage = (completedSteps / totalSteps) * 100;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Progress Bar */}
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div 
          className="bg-blue-600 h-2 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progressPercentage}%` }}
        ></div>
      </div>
      
      {/* Progress Text */}
      <div className="text-center">
        <p className="text-sm text-gray-600">
          {completedSteps} sur {totalSteps} étapes terminées
        </p>
      </div>

      {/* Steps List */}
      <div className="space-y-3">
        {currentSteps.map((step) => (
          <div 
            key={step.id} 
            className={`flex items-center space-x-3 p-3 rounded-lg transition-all duration-300 ${
              step.status === 'loading' ? 'bg-blue-50 border border-blue-200' :
              step.status === 'completed' ? 'bg-green-50 border border-green-200' :
              step.status === 'error' ? 'bg-red-50 border border-red-200' :
              'bg-gray-50 border border-gray-200'
            }`}
          >
            {getStepIcon(step)}
            <div className="flex-1">
              <p className={`text-sm font-medium ${getStepStatus(step)}`}>
                {step.label}
              </p>
              {step.error && (
                <p className="text-xs text-red-600 mt-1">{step.error}</p>
              )}
            </div>
            {step.status === 'loading' && (
              <div className="text-xs text-blue-600">
                En cours...
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// Hook for managing progressive loading
export const useProgressiveLoading = (initialSteps: LoadingStep[]) => {
  const [steps, setSteps] = useState<LoadingStep[]>(initialSteps);

  const updateStep = (stepId: string, updates: Partial<LoadingStep>) => {
    setSteps(prevSteps => 
      prevSteps.map(step => 
        step.id === stepId ? { ...step, ...updates } : step
      )
    );
  };

  const startStep = (stepId: string) => {
    updateStep(stepId, { status: 'loading' });
  };

  const completeStep = (stepId: string) => {
    updateStep(stepId, { status: 'completed' });
  };

  const errorStep = (stepId: string, error: string) => {
    updateStep(stepId, { status: 'error', error });
  };

  const resetSteps = () => {
    setSteps(prevSteps => 
      prevSteps.map(step => ({ ...step, status: 'pending', error: undefined }))
    );
  };

  return {
    steps,
    updateStep,
    startStep,
    completeStep,
    errorStep,
    resetSteps
  };
};
