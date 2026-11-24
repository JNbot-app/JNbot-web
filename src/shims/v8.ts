export const setFlagsFromString = () => undefined;
export const getHeapStatistics = () => {
  const memory = (performance as any).memory;
  return { used_heap_size: memory?.usedJSHeapSize ?? 0, total_heap_size: memory?.totalJSHeapSize ?? 0, heap_size_limit: memory?.jsHeapSizeLimit ?? 0 };
};
export const serialize = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
export const deserialize = (value: Uint8Array) => JSON.parse(new TextDecoder().decode(value));
export default { setFlagsFromString, getHeapStatistics, serialize, deserialize };
