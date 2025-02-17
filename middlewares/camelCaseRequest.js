import camelizeKeys from 'camelize-keys';

export function camelCaseRequest(req, res, next) {
  if (req && req.body) {
    req.body = camelizeKeys(req.body, '_');
  }
  next();
}
