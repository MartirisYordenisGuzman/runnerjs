import type { RendererProps } from './types';
import { ValueRenderer } from './ValueRenderer';

export const TableRenderer = ({ log, highlighting = true }: RendererProps) => {
  const data = log.table;
  if (!data || !data.rows || data.rows.length === 0) return null;

  return (
    <div style={{ 
      margin: '8px 0', 
      border: '1px solid var(--border-color)', 
      borderRadius: '6px', 
      overflow: 'hidden',
      maxWidth: '100%',
      backgroundColor: 'rgba(255, 255, 255, 0.03)',
      display: 'inline-block',
      width: 'auto'
    }}>
      <table style={{ 
        width: 'auto', 
        display: 'inline-table',
        borderCollapse: 'collapse', 
        fontSize: '12px',
        textAlign: 'left'
      }}>
        <thead>
          <tr style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', borderBottom: '1px solid var(--border-color)' }}>
            {data.columns.map((col: string) => (
              <th key={col} style={{ padding: '6px 10px', color: 'var(--text-muted)', fontWeight: 600 }}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row: any, i: number) => (
            <tr key={i} style={{ borderBottom: i < data.rows.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
              {data.columns.map((col: string) => (
                <td key={col} style={{ padding: '4px 10px', borderRight: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  <ValueRenderer value={row[col]} highlighting={highlighting} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
