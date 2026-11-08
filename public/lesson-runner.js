// Bootstrapped inside an opaque-origin iframe. No network or browser storage.
self.onmessage = ({ data, ports }) => {
  const port = ports[0],
    send = port.postMessage.bind(port),
    execute = executeLesson;
  port.onmessage = () => {
    try {
      send({ result: execute(data.input, data.source, data.limit) });
    } catch (error) {
      send({ error: String(error?.message || error).slice(0, 600) });
    }
  };
  port.start();
  send({ ready: true });
};
