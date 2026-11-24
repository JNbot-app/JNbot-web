import { promises } from './dns';

export const { resolveSrv, lookup } = promises;
export default promises;
