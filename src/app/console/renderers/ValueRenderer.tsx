import type { ValueRendererProps } from './types';
import { PrimitiveRenderer } from './PrimitiveRenderer';
import { ObjectRenderer } from './ObjectRenderer';

export const ValueRenderer = (props: ValueRendererProps) => {
  const { value } = props;
  const itemType = (value && typeof value === 'object' && 'type' in value) ? (value as { type: string }).type : typeof value;

  if (['object', 'array', 'map', 'set', 'function', 'date', 'promise', 'circular'].includes(itemType)) {
    return <ObjectRenderer {...props} />;
  }

  return <PrimitiveRenderer {...props} />;
};
