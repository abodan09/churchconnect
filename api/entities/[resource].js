// List / create for a resource: /api/entities/<resource>
import entitiesHandler from '../../src/lib/entitiesHandler.js';

export default function handler(req, res) {
  return entitiesHandler(req, res, req.query.resource, undefined);
}
