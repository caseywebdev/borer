export default Object.fromEntries(
  ['start', 'data', 'end'].map((name, i) => [name, Buffer.from([i])])
);
