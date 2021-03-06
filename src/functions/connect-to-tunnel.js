import http from 'http';
import https from 'https';

import WebSocket from 'ws';

import messageTypes from '../constants/message-types.js';

export default ({ localUrl, tunnelUrl }) => {
  console.log('Connecting...');
  const socket = new WebSocket(
    `${tunnelUrl.replace(/^http/, 'ws')}/.well-known/borer/connect`
  );
  const { request } = localUrl.startsWith('https:') ? https : http;
  const requests = {};
  let pingIntervalId;
  let heartbeatTimeoutId;
  const heartbeat = () => {
    clearTimeout(heartbeatTimeoutId);
    heartbeatTimeoutId = setTimeout(() => socket.terminate(), 35000);
  };
  socket.on('open', () => {
    pingIntervalId = setInterval(() => socket.ping(), 30000);
    heartbeat();
    console.log('Connected');
  });
  socket.on('pong', heartbeat);
  socket.on('close', () => {
    clearInterval(pingIntervalId);
    clearTimeout(heartbeatTimeoutId);
    console.log('Connection closed');
  });
  socket.on('error', er => console.error(er));
  socket.on('message', message => {
    const type = message.slice(0, 1);
    const id = message.slice(1, 5);
    const idHex = id.toString('hex');
    const data = message.slice(5);
    if (type.equals(messageTypes.start)) {
      const { headers, method, path } = JSON.parse(data);
      console.log(`${method} ${path}`);
      requests[idHex] = request(localUrl + path, { method, headers }, res => {
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
      requests[idHex]?.write(data);
    } else if (type.equals(messageTypes.end)) {
      requests[idHex]?.end();
      delete requests[idHex];
    }
  });
};
