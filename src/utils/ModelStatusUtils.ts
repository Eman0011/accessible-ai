import { StatusIndicatorProps } from "@cloudscape-design/components";

export type ModelStatus = 
  | 'SUBMITTED' 
  | 'TRAINING' 
  | 'TRAINING_COMPLETED' 
  | 'TRAINING_FAILED' 
  | 'DRAFT';

interface StatusConfig {
  type: StatusIndicatorProps.Type;
  text: string;
}

const STATUS_MAP: Record<ModelStatus, StatusConfig> = {
  TRAINING: {
    type: 'in-progress',
    text: 'Training'
  },
  TRAINING_COMPLETED: {
    type: 'success',
    text: 'Completed'
  },
  TRAINING_FAILED: {
    type: 'error',
    text: 'Failed'
  },
  DRAFT: {
    type: 'stopped',
    text: 'Pending'
  },
  SUBMITTED: {
    type: 'stopped',
    text: 'Pending'
  }
} as const;

const DEFAULT_STATUS: StatusConfig = {
  type: 'pending',
  text: 'Unknown'
};

export const getModelStatusIndicatorProps = (status?: string): StatusConfig => {
  if (!status) return DEFAULT_STATUS;
  
  const normalizedStatus = status.toUpperCase() as ModelStatus;
  return STATUS_MAP[normalizedStatus] || {
    type: 'pending',
    text: status
  };
}; 