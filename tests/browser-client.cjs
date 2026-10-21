// CDP helpers for tests against a disposable Chromium profile.
async function connect(target) {
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
  let id = 0; const pending = new Map();
  ws.addEventListener('message', event => { const message = JSON.parse(event.data); if (message.id) {
    const request = pending.get(message.id); pending.delete(message.id);
    message.error ? request.reject(Error(message.error.message)) : request.resolve(message.result);
  } });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const request = ++id; pending.set(request, { resolve, reject }); ws.send(JSON.stringify({ id: request, method, params }));
  });
  const evaluate = async (expression, { userGesture = true } = {}) => {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture });
    if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  return { send, evaluate, ws };
}
async function waitFor(test) {
  for (let i = 0; i < 120; i++) { if (await test()) return; await new Promise(resolve => setTimeout(resolve, 50)); }
  throw Error('Timed out waiting for browser state');
}
module.exports = { connect, waitFor };
