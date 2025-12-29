import React from 'react';
import { Alert } from '@grafana/ui';
import { ITEM_COUNT_WARNING_THRESHOLD } from '../constants';

interface ItemCountWarningProps {
  itemCount: number;
  threshold?: number;
}

/**
 * A warning banner that displays when the query matches too many items.
 * This is a non-intrusive warning that doesn't block the query flow.
 */
export const ItemCountWarning: React.FC<ItemCountWarningProps> = ({
  itemCount,
  threshold = ITEM_COUNT_WARNING_THRESHOLD,
}) => {
  if (itemCount < threshold) {
    return null;
  }

  return (
    <Alert title="Large number of items" severity="warning">
      This query matches {itemCount} items and may return a large amount of data. Consider using more specific filters.
    </Alert>
  );
};
