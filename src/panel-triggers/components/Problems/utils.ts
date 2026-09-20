export const capitalizeFirstLetter = (str: string): string => str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();

export const parseCustomTagColumns = (customTagColumns?: string): string[] => {
  if (!customTagColumns) {
    return [];
  }

  return customTagColumns
    .split(',')
    .map((tagName) => tagName.trim())
    .filter(Boolean);
};

/**
 * Turn a saved column order into one that matches the columns the table has right now.
 *
 * - ids that no longer exist are dropped;
 * - ids the saved order does not know (new custom tag columns, columns added in a later
 *   version) slot in right after their nearest preceding neighbour from the default
 *   order, or first when nothing precedes them, instead of piling up at the end;
 * - pinned ids are kept out of the sortable part and always come last, in default order.
 *
 * An empty saved order yields the default order.
 */
export const reconcileColumnOrder = (
  savedOrder: string[] | undefined,
  defaultOrder: string[],
  pinnedIds: string[] = []
): string[] => {
  const pinned = new Set(pinnedIds);
  const sortableDefaults = defaultOrder.filter((id) => !pinned.has(id));
  const known = new Set(sortableDefaults);

  const order: string[] = [];
  for (const id of savedOrder ?? []) {
    if (known.has(id) && !order.includes(id)) {
      order.push(id);
    }
  }

  sortableDefaults.forEach((id, index) => {
    if (order.includes(id)) {
      return;
    }
    // Closest default neighbour before this id that is already placed
    const previous = sortableDefaults
      .slice(0, index)
      .reverse()
      .find((candidate) => order.includes(candidate));
    const at = previous === undefined ? 0 : order.indexOf(previous) + 1;
    order.splice(at, 0, id);
  });

  return [...order, ...defaultOrder.filter((id) => pinned.has(id))];
};
