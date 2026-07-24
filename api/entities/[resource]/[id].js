// Get / update / delete a single record: /api/entities/<resource>/<id>
import entitiesHandler from '../../../src/lib/entitiesHandler.js';

export default function handler(req, res) {
  return entitiesHandler(req, res, req.query.resource, req.query.id);
}
