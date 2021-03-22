import http from 'http';
import https from 'https';

import WebSocket from 'ws';

import messageTypes from '../constants/message-types.js';

export default ({ localUrl, tunnelUrl }) => {
  console.log('Connecting...');
  const socket = new WebSocket(tunnelUrl.replace(/^http/, 'ws'));
  const { request } = localUrl.startsWith('https:') ? https : http;
  const requests = {};
  socket.on('open', () => console.log('Connected'));
  socket.on('close', () => console.log('Connection closed'));
  socket.on('error', er => console.error(er));
  socket.on('message', message => {
    const type = message.slice(0, 1);
    const id = message.slice(1, 5);
    const data = message.slice(5);
    if (type.equals(messageTypes.start)) {
      const { headers, method, path } = JSON.parse(data);
      console.log(`${method} ${path}`);
      requests[id] = request(localUrl + path, { method, headers }, res => {
        socket.send(
          Buffer.concat([
            messageTypes.start,
            id,
            Buffer.from(
              JSON.stringify({ status: res.statusCode, headers: res.headers })
            )
          ])
        );
        res
          .on('data', data =>
            socket.send(Buffer.concat([messageTypes.data, id, data]))
          )
          .on('end', () => socket.send(Buffer.concat([messageTypes.end, id])));
      });
    } else if (type.equals(messageTypes.data)) {
      requests[id]?.write(data);
    } else if (type.equals(messageTypes.end)) {
      requests[id]?.end();
      delete requests[id];
    }
  });
};
