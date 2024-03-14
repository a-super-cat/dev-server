export const asyncFilter = async <T>(arr: T[], predicate: (arg: T) => Promise<boolean>): Promise<T[]>=> {
  const result: T[] = [];
  for (const item of arr) {
    if (await predicate(item)) {
      result.push(item);
    }
  }
  return result;
};