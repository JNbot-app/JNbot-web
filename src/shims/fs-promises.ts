import fs from './fs';

const promises = fs.promises;
export const { readFile, writeFile, appendFile, mkdir, readdir, stat, lstat, rm, rmdir, unlink, rename, copyFile, access, open, realpath, mkdtemp, cp } = promises;
export const constants = fs.constants;
export default promises;
