import commander from 'commander';

import connectToTunnel from '../functions/connect-to-tunnel.js';

const { program } = commander;

export default program
  .command('connect')
  .description('Connect to a tunnel')
  .requiredOption(
    '-t, --tunnel-url [tunnelUrl]',
    'the http(s)://[key]@tunnel.url to connect to'
  )
  .requiredOption(
    '-l, --local-url [localUrl]',
    'the http(s)://local.url to send tunneled requests to'
  )
  .action(connectToTunnel);
