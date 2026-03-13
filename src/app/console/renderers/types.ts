import type { ConsoleLogMessage } from '../../../shared/ipc';

export interface SerializedValue {
  type: string;
  value: any;
  className?: string;
  size?: number;
  signature?: string;
}

export interface RendererProps {
  log: ConsoleLogMessage;
  highlighting?: boolean;
}

export interface ValueRendererProps {
  value: SerializedValue | any;
  highlighting?: boolean;
  isError?: boolean;
  isCaptured?: boolean;
  depth?: number;
  label?: string;
}
