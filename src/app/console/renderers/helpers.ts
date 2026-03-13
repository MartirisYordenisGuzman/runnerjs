import type { ConsoleLogMessage } from '../../../shared/ipc';

export const getLogColor = (type: string, isCaptured?: boolean) => {
  switch (type) {
    case 'warn': return '#e6db74';
    case 'error': return '#ff5555';
    case 'info': return '#66d9ef';
    case 'debug': return '#a6e22e';
    case 'group': return 'var(--accent-color)';
    case 'log': return isCaptured ? 'var(--text-muted)' : 'var(--color-log)';
    default: return 'var(--text-primary)';
  }
};

export const getLogBadge = (type: string) => {
  switch (type) {
    case 'warn': return 'WARN';
    case 'error': return 'ERR';
    case 'info': return 'INFO';
    case 'debug': return 'DEBUG';
    case 'timeEnd': return 'TIME';
    default: return '';
  }
};

export const getBadgeBg = (type: string) => {
  switch (type) {
    case 'warn': return 'rgba(230, 219, 116, 0.15)';
    case 'error': return 'rgba(255, 85, 85, 0.15)';
    case 'info': return 'rgba(102, 217, 239, 0.15)';
    case 'debug': return 'rgba(166, 226, 46, 0.15)';
    default: return 'transparent';
  }
};
