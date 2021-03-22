#!/usr/bin/env node

import commands from './commands/index.js';

commands.parseAsync(process.argv).catch(er => {
  console.error(er.stack);
  process.exit(1);
});
