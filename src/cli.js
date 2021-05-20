#!/usr/bin/env node

import commands from './commands/index.js';

const handleSignal = signal => {
  console.log(`Received ${signal}, exiting immediately...`);
  process.exit(1);
};

process.on('SIGINT', handleSignal).on('SIGTERM', handleSignal);

commands.parseAsync(process.argv).catch(er => {
  console.error(er.stack);
  process.exit(1);
});
