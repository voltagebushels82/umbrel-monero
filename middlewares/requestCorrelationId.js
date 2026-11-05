import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
export const requestContext = new AsyncLocalStorage();
export default function addCorrelationId(req, res, next) {
  requestContext.run({reqId: randomUUID()}, next);
}
