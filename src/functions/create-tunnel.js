import http from 'http';

import WebSocket from 'ws';

import messageTypes from '../constants/message-types.js';

const sockets = {};
const responses = {};

const notFound = res => {
  res.statusCode = 404;
  return res.end('Not Found');
};

let prevId = 0x00000000;
const maxId = 0xffffffff;
const maxIdHex = maxId.toString(16);

const getKey = authorization => {
  let [type, key] = `${authorization ?? ''}`.trim().split(/\s+/);

  if (!key) return type;

  if (type.toLowerCase() === 'basic') {
    try {
      const [left, right] = Buffer.from(key, 'base64').toString().split(':');
      key = right || left || '';
    } catch {
      // noop
    }
  }

  return key;
};

const handleMessage = message => {
  const type = message.slice(0, 1);
  const idHex = message.slice(1, 5).toString('hex');
  const response = responses[idHex];
  if (!response) return;

  const data = message.slice(5);
  if (type.equals(messageTypes.start)) {
    const { headers, status } = JSON.parse(data);
    response.writeHead(status, headers);
  } else if (type.equals(messageTypes.data)) {
    response.write(data);
  } else if (type.equals(messageTypes.end)) {
    response.end();
    delete responses[idHex];
  }
};

export default ({ key, port }) => {
  const server = http.createServer(async (req, res) => {
    let {
      url,
      headers: { host, ...headers },
      method
    } = req;
    if (host === 'localhost' && url === '/healthz') return res.end('OK');

    const socket = sockets[host];
    if (!socket) return notFound(res);

    prevId = ++prevId % maxId;
    let idHex = prevId.toString(16);
    idHex = '0'.repeat(maxIdHex.length - idHex.length) + idHex;
    const id = Buffer.from(idHex, 'hex');
    const { remoteAddress } = req.socket;
    headers = {
      ...headers,
      'x-forwarded-for':
        headers['x-forwarded-for']
          ?.split(/\s*,\s*/)
          .slice(0, -1)
          .concat(remoteAddress)
          .join(', ') ?? remoteAddress
    };
    responses[idHex] = res;
    socket.send(
      Buffer.concat([
        messageTypes.start,
        id,
        Buffer.from(JSON.stringify({ path: url, headers, method }))
      ])
    );
    req
      .on('data', data =>
        socket.send(Buffer.concat([messageTypes.data, id, data]))
      )
      .on('end', () => socket.send(Buffer.concat([messageTypes.end, id])));
  });

  const wss = new WebSocket.Server({ server });
  // TODO: Add websocket proxy support, a proxy host connection should hit a
  // /.well-known/borer-connect URL and all other URLs should proxy to
  // sockets[host].
  wss.on('connection', (ws, req) => {
    const { authorization, host } = req.headers;
    if (sockets[host] || (key && getKey(authorization) !== key)) {
      return ws.close();
    }

    console.log(`Proxy for host '${host}' connected`);
    sockets[host] = ws;
    ws.on('message', handleMessage);
    ws.on('close', () => {
      console.log(`Proxy for host '${host}' disconnected`);
      delete sockets[host];
    });
  });

  server.listen(port);
};
