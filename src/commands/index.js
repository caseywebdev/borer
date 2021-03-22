import fs from 'fs';
import path from 'path';
import url from 'url';

import commander from 'commander';

import './connect.js';
import './tunnel.js';

const { program } = commander;
const thisPath = url.fileURLToPath(import.meta.url);
const packagePath = `${path.dirname(thisPath)}/../../package.json`;
const { version } = JSON.parse(fs.readFileSync(packagePath));

export default program
  .version(version)
  .description('Borer Command Line Interface');
