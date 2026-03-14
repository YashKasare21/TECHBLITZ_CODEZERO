// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const qs = (param: any): string | undefined => {
  if (param === undefined || param === null) return undefined;
  if (typeof param === 'string') return param;
  if (Array.isArray(param) && param.length > 0) return String(param[0]);
  return undefined;
};
