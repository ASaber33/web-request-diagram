const express = require('express');
const pool = require('./db');

const app = express();
const port = Number(process.env.PORT || 3000);

// These names come from the existing clients_db schema. They are kept here
// instead of reading table names from the request, so SQL table names stay safe.
const resources = [
  {
    paths: ['/sellers'],
    table: 'sellers',
    label: 'Seller',
    fields: [
      { name: 'seller_name', type: 'text' },
      { name: 'email', type: 'text' },
    ],
    searchFields: ['seller_name', 'email'],
    searchQuery: `
      SELECT
        s.id AS seller_id,
        s.seller_name,
        s.email,
        p.id AS product_id,
        p.product,
        sp.price,
        p.added_at
      FROM sellers s
      JOIN products p ON p.seller_id = s.id
      LEFT JOIN seller_products sp
        ON sp.seller_name = s.seller_name
       AND sp.email = s.email
       AND sp.product = p.product
      WHERE s.seller_name ILIKE $1
      ORDER BY s.seller_name, p.added_at DESC, p.id
    `,
  },
  {
    paths: ['/products'],
    table: 'products',
    label: 'Product',
    fields: [
      { name: 'seller_id', type: 'id' },
      { name: 'product', type: 'text' },
    ],
    searchFields: ['product'],
    searchQuery: `
      SELECT
        p.id AS product_id,
        p.product,
        sp.price,
        p.added_at,
        s.id AS seller_id,
        s.seller_name,
        s.email
      FROM products p
      JOIN sellers s ON s.id = p.seller_id
      LEFT JOIN seller_products sp
        ON sp.seller_name = s.seller_name
       AND sp.email = s.email
       AND sp.product = p.product
      WHERE p.product ILIKE $1
      ORDER BY p.product, p.added_at DESC, p.id
    `,
  },
  {
    // Both spellings work. The underscore version matches the table name.
    paths: ['/seller_products', '/seller-products'],
    table: 'seller_products',
    label: 'Seller product',
    fields: [
      { name: 'seller_name', type: 'text' },
      { name: 'email', type: 'text' },
      { name: 'product', type: 'text' },
      { name: 'price', type: 'price' },
    ],
    searchFields: ['seller_name', 'email', 'product'],
  },
];

app.use(express.json());

function isPositiveId(value) {
  return (
    (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) ||
    (typeof value === 'string' && /^[1-9]\d*$/.test(value))
  );
}

function isValidPrice(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= 0;
  }

  return typeof value === 'string' && /^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value.trim());
}

function validateBody(body, resource, requireAllFields) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Request body must be a JSON object' };
  }

  const fieldNames = resource.fields.map((field) => field.name);
  const suppliedFields = fieldNames.filter((field) =>
    Object.prototype.hasOwnProperty.call(body, field)
  );
  const unknownFields = Object.keys(body).filter((field) => !fieldNames.includes(field));

  if (unknownFields.length > 0) {
    return { error: `Only these fields are allowed: ${fieldNames.join(', ')}` };
  }

  if (requireAllFields && suppliedFields.length !== fieldNames.length) {
    return { error: `All fields are required: ${fieldNames.join(', ')}` };
  }

  if (!requireAllFields && suppliedFields.length === 0) {
    return { error: `Provide at least one field to update: ${fieldNames.join(', ')}` };
  }

  for (const field of resource.fields) {
    if (!suppliedFields.includes(field.name)) {
      continue;
    }

    const value = body[field.name];
    if (field.type === 'id' && !isPositiveId(value)) {
      return { error: `${field.name} must be a positive integer` };
    }

    if (field.type === 'text' && (typeof value !== 'string' || value.trim() === '')) {
      return { error: `${field.name} must be a non-empty string` };
    }

    if (field.type === 'price' && !isValidPrice(value)) {
      return { error: 'price must be a non-negative number' };
    }
  }

  return { fields: suppliedFields };
}

function sendDatabaseError(error, res, action) {
  console.error(`${action}:`, error.message);

  if (error.code === '23505') {
    return res.status(409).json({ error: 'A record with the same unique value already exists' });
  }

  if (error.code === '23503') {
    return res.status(400).json({ error: 'seller_id must refer to an existing seller' });
  }

  return res.status(500).json({ error: action });
}

function registerResourceRoutes(resource) {
  const fieldNames = resource.fields.map((field) => field.name);

  const list = async (req, res) => {
    const rawSearch = req.query.search ?? req.query.q;

    if (rawSearch !== undefined && typeof rawSearch !== 'string') {
      return res.status(400).json({ error: 'search must be a single string' });
    }

    try {
      const search = rawSearch?.trim();
      const searchSql =
        resource.searchQuery ||
        `SELECT * FROM ${resource.table} WHERE ${resource.searchFields
          .map((field) => `${field} ILIKE $1`)
          .join(' OR ')} ORDER BY id`;
      const result = search
        ? await pool.query(searchSql, [`%${search}%`])
        : await pool.query(`SELECT * FROM ${resource.table} ORDER BY id`);

      return res.json(result.rows);
    } catch (error) {
      return sendDatabaseError(error, res, `Could not read ${resource.table}`);
    }
  };

  const getOne = async (req, res) => {
    if (!isPositiveId(req.params.id)) {
      return res.status(400).json({ error: 'id must be a positive integer' });
    }

    try {
      const result = await pool.query(
        `SELECT * FROM ${resource.table} WHERE id = $1`,
        [req.params.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: `${resource.label} not found` });
      }

      return res.json(result.rows[0]);
    } catch (error) {
      return sendDatabaseError(error, res, `Could not read ${resource.table}`);
    }
  };

  const create = async (req, res) => {
    const payload = validateBody(req.body, resource, true);
    if (payload.error) {
      return res.status(400).json({ error: payload.error });
    }

    try {
      // id is GENERATED ALWAYS AS IDENTITY in clients_db, so PostgreSQL creates it.
      const result = await pool.query(
        `INSERT INTO ${resource.table} (${fieldNames.join(', ')})
         VALUES (${fieldNames
           .map((_field, index) => `$${index + 1}`)
           .join(', ')})
         RETURNING *`,
        fieldNames.map((field) => req.body[field])
      );

      return res.status(201).json(result.rows[0]);
    } catch (error) {
      return sendDatabaseError(error, res, `Could not create ${resource.label.toLowerCase()}`);
    }
  };

  const replace = async (req, res) => {
    if (!isPositiveId(req.params.id)) {
      return res.status(400).json({ error: 'id must be a positive integer' });
    }

    const payload = validateBody(req.body, resource, true);
    if (payload.error) {
      return res.status(400).json({ error: payload.error });
    }

    try {
      const result = await pool.query(
        `UPDATE ${resource.table}
         SET ${fieldNames.map((field, index) => `${field} = $${index + 1}`).join(', ')}
         WHERE id = $${fieldNames.length + 1}
         RETURNING *`,
        [...fieldNames.map((field) => req.body[field]), req.params.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: `${resource.label} not found` });
      }

      return res.json(result.rows[0]);
    } catch (error) {
      return sendDatabaseError(error, res, `Could not replace ${resource.label.toLowerCase()}`);
    }
  };

  const update = async (req, res) => {
    if (!isPositiveId(req.params.id)) {
      return res.status(400).json({ error: 'id must be a positive integer' });
    }

    const payload = validateBody(req.body, resource, false);
    if (payload.error) {
      return res.status(400).json({ error: payload.error });
    }

    const values = payload.fields.map((field) => req.body[field]);
    values.push(req.params.id);

    try {
      const result = await pool.query(
        `UPDATE ${resource.table}
         SET ${payload.fields.map((field, index) => `${field} = $${index + 1}`).join(', ')}
         WHERE id = $${values.length}
         RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: `${resource.label} not found` });
      }

      return res.json(result.rows[0]);
    } catch (error) {
      return sendDatabaseError(error, res, `Could not update ${resource.label.toLowerCase()}`);
    }
  };

  const remove = async (req, res) => {
    if (!isPositiveId(req.params.id)) {
      return res.status(400).json({ error: 'id must be a positive integer' });
    }

    try {
      const result = await pool.query(
        `DELETE FROM ${resource.table} WHERE id = $1 RETURNING *`,
        [req.params.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: `${resource.label} not found` });
      }

      return res.json(result.rows[0]);
    } catch (error) {
      return sendDatabaseError(error, res, `Could not delete ${resource.label.toLowerCase()}`);
    }
  };

  for (const path of resource.paths) {
    app.get(path, list);
    app.get(`${path}/:id`, getOne);
    app.post(path, create);
    app.put(`${path}/:id`, replace);
    app.patch(`${path}/:id`, update);
    app.delete(`${path}/:id`, remove);
  }
}

for (const resource of resources) {
  registerResourceRoutes(resource);
}

app.get('/', (_req, res) => {
  res.json({
    message: 'Clients API is running',
    routes: ['/sellers', '/products', '/seller_products'],
  });
});

app.use((error, _req, res, _next) => {
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return res.status(400).json({ error: 'Request body contains invalid JSON' });
  }

  console.error('Unexpected server error:', error.message);
  return res.status(500).json({ error: 'Unexpected server error' });
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}

module.exports = app;
