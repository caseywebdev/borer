import commander from 'commander';

import createTunnel from '../functions/create-tunnel.js';

const { program } = commander;

export default program
  .command('tunnel')
  .description('Create a tunnel')
  .option(
    '-p, --port [port]',
    'port to listen for requests on',
    n => parseInt(n) || 80,
    80
  )
  .option(
    '-k, --key [key]',
    'authentication key to require tunnel connections to supply'
  )
  .action(createTunnel);
