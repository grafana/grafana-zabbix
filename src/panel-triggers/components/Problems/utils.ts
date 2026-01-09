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
