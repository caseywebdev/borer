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
  const id = message.slice(1, 5);
  const response = responses[id];
  if (!response) return;

  const data = message.slice(5);
  if (type.equals(messageTypes.start)) {
    const { headers, status } = JSON.parse(data);
    for (const [key, value] of Object.entries(headers)) {
      response.setHeader(key, value);
    }
    response.statusCode = status;
  } else if (type.equals(messageTypes.data)) {
    responses[id]?.write(data);
  } else if (type.equals(messageTypes.end)) {
    responses[id]?.end();
    delete responses[id];
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

    const idHex = (prevId = (prevId + 1) % maxId).toString(16);
    const id = Buffer.from(
      '0'.repeat(maxIdHex.length - idHex.length) + idHex,
      'hex'
    );
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
    responses[id] = res;
    socket.send(
      Buffer.concat([
        messageTypes.start,
        id,
        Buffer.from(
          JSON.stringify({
            id,
            path: url,
            headers,
            method
          })
        )
      ])
    );
    req
      .on('data', data =>
        socket.send(Buffer.concat([messageTypes.data, id, data]))
      )
      .on('end', () => socket.send(Buffer.concat([messageTypes.end, id])));
  });

  const wss = new WebSocket.Server({ server });
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
