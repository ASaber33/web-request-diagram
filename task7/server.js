const express = require('express');
require('dotenv').config();
const { register, login, ensureUsersTable, getProfile } = require('./user');
const authMiddleware = require('./middleware/auth_middleware');
const AppDataSource = require('./db');
const Seller = require('./seller');
const Product = require('./product');
const SellerProduct = require('./sellerProduct');

const app = express();
const port = Number(process.env.PORT || 3100);

app.use(express.json({ limit: '10kb' }));

const resources = [
  { paths: ['/sellers'], entity: 'Seller', table: 'sellers', label: 'Seller', fields: [{ name: 'seller_name', type: 'text' }, { name: 'email', type: 'text' }], searchFields: ['seller_name', 'email'], searchType: 'seller' },
  { paths: ['/products'], entity: 'Product', table: 'products', label: 'Product', fields: [{ name: 'seller_id', type: 'id' }, { name: 'product', type: 'text' }], searchFields: ['product'], searchType: 'product' },
  { paths: ['/seller_products', '/seller-products'], entity: 'SellerProduct', table: 'seller_products', label: 'Seller product', fields: [{ name: 'seller_name', type: 'text' }, { name: 'email', type: 'text' }, { name: 'product', type: 'text' }, { name: 'price', type: 'price' }], searchFields: ['seller_name', 'email', 'product'] }
];

function isPositiveId(value) {
  return (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) || (typeof value === 'string' && /^[1-9]\d*$/.test(value));
}

function validateBody(body, resource, requireAllFields) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'Request body must be a JSON object' };
  const fieldNames = resource.fields.map((field) => field.name);
  const suppliedFields = fieldNames.filter((field) => Object.prototype.hasOwnProperty.call(body, field));
  const unknownFields = Object.keys(body).filter((field) => !fieldNames.includes(field));
  if (unknownFields.length) return { error: `Only these fields are allowed: ${fieldNames.join(', ')}` };
  if (requireAllFields && suppliedFields.length !== fieldNames.length) return { error: `All fields are required: ${fieldNames.join(', ')}` };
  if (!requireAllFields && suppliedFields.length === 0) return { error: `Provide at least one field to update: ${fieldNames.join(', ')}` };
  for (const field of resource.fields) {
    if (!suppliedFields.includes(field.name)) continue;
    const value = body[field.name];
    if (field.type === 'id' && !isPositiveId(value)) return { error: `${field.name} must be a positive integer` };
    if (field.type === 'text' && (typeof value !== 'string' || value.trim() === '')) return { error: `${field.name} must be a non-empty string` };
    if (field.type === 'price' && !(typeof value === 'number' ? Number.isFinite(value) && value >= 0 : typeof value === 'string' && /^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value.trim()))) return { error: 'price must be a non-negative number' };
  }
  return { fields: suppliedFields };
}

function sendDatabaseError(error, res, action) {
  console.error(`${action}:`, error.message);
  const code = error.driverError?.code || error.code;
  if (code === '23505') return res.status(409).json({ error: 'A record with the same unique value already exists' });
  if (code === '23503') return res.status(400).json({ error: 'seller_id must refer to an existing seller' });
  return res.status(500).json({ error: action });
}

function buildSearchQuery(resource, repository, search) {
  const query = repository.createQueryBuilder(resource.entity === 'SellerProduct' ? 'sellerProduct' : resource.entity.toLowerCase());
  if (resource.searchType === 'seller') {
    return query.innerJoin(Product, 'product', 'product.seller_id = seller.id')
      .leftJoin(SellerProduct, 'sellerProduct', 'sellerProduct.seller_name = seller.seller_name AND sellerProduct.email = seller.email AND sellerProduct.product = product.product')
      .select('seller.id', 'seller_id').addSelect('seller.seller_name', 'seller_name').addSelect('seller.email', 'email')
      .addSelect('product.id', 'product_id').addSelect('product.product', 'product').addSelect('sellerProduct.price', 'price')
      .addSelect('product.added_at', 'added_at').where('seller.seller_name ILIKE :search', { search: `%${search}%` })
      .orderBy('seller.seller_name', 'ASC').addOrderBy('product.added_at', 'DESC').addOrderBy('product.id', 'ASC');
  }
  if (resource.searchType === 'product') {
    return query.innerJoin(Seller, 'seller', 'seller.id = product.seller_id')
      .leftJoin(SellerProduct, 'sellerProduct', 'sellerProduct.seller_name = seller.seller_name AND sellerProduct.email = seller.email AND sellerProduct.product = product.product')
      .select('product.id', 'product_id').addSelect('product.product', 'product').addSelect('sellerProduct.price', 'price')
      .addSelect('product.added_at', 'added_at').addSelect('seller.id', 'seller_id').addSelect('seller.seller_name', 'seller_name')
      .addSelect('seller.email', 'email').where('product.product ILIKE :search', { search: `%${search}%` })
      .orderBy('product.product', 'ASC').addOrderBy('product.added_at', 'DESC').addOrderBy('product.id', 'ASC');
  }
  const alias = resource.entity === 'SellerProduct' ? 'sellerProduct' : resource.entity.toLowerCase();
  return query.where(resource.searchFields.map((field) => `${alias}.${field} ILIKE :search`).join(' OR '), { search: `%${search}%` }).orderBy(`${alias}.id`, 'ASC');
}

function registerResourceRoutes(resource) {
  const fieldNames = resource.fields.map((field) => field.name);
  const list = async (req, res) => {
    const rawSearch = req.query.search ?? req.query.q;
    if (rawSearch !== undefined && typeof rawSearch !== 'string') return res.status(400).json({ error: 'search must be a single string' });
    try {
      const repository = AppDataSource.getRepository(resource.entity);
      const search = typeof rawSearch === 'string' ? rawSearch.trim() : '';
      if (!search) return res.json(await repository.find({ order: { id: 'ASC' } }));
      const query = buildSearchQuery(resource, repository, search);
      return res.json(resource.searchType ? await query.getRawMany() : await query.getMany());
    } catch (error) { return sendDatabaseError(error, res, `Could not read ${resource.table}`); }
  };
  const getOne = async (req, res) => {
    if (!isPositiveId(req.params.id)) return res.status(400).json({ error: 'id must be a positive integer' });
    try {
      const row = await AppDataSource.getRepository(resource.entity).findOneBy({ id: req.params.id });
      return row ? res.json(row) : res.status(404).json({ error: `${resource.label} not found` });
    } catch (error) { return sendDatabaseError(error, res, `Could not read ${resource.table}`); }
  };
  const create = async (req, res) => {
    const payload = validateBody(req.body, resource, true);
    if (payload.error) return res.status(400).json({ error: payload.error });
    try {
      const repository = AppDataSource.getRepository(resource.entity);
      const values = Object.fromEntries(fieldNames.map((field) => [field, req.body[field]]));
      return res.status(201).json(await repository.save(repository.create(values)));
    } catch (error) { return sendDatabaseError(error, res, `Could not create ${resource.label.toLowerCase()}`); }
  };
  const replace = async (req, res) => {
    if (!isPositiveId(req.params.id)) return res.status(400).json({ error: 'id must be a positive integer' });
    const payload = validateBody(req.body, resource, true);
    if (payload.error) return res.status(400).json({ error: payload.error });
    try {
      const repository = AppDataSource.getRepository(resource.entity);
      const row = await repository.findOneBy({ id: req.params.id });
      if (!row) return res.status(404).json({ error: `${resource.label} not found` });
      for (const field of fieldNames) row[field] = req.body[field];
      return res.json(await repository.save(row));
    } catch (error) { return sendDatabaseError(error, res, `Could not replace ${resource.label.toLowerCase()}`); }
  };
  const update = async (req, res) => {
    if (!isPositiveId(req.params.id)) return res.status(400).json({ error: 'id must be a positive integer' });
    const payload = validateBody(req.body, resource, false);
    if (payload.error) return res.status(400).json({ error: payload.error });
    try {
      const repository = AppDataSource.getRepository(resource.entity);
      const row = await repository.findOneBy({ id: req.params.id });
      if (!row) return res.status(404).json({ error: `${resource.label} not found` });
      for (const field of payload.fields) row[field] = req.body[field];
      return res.json(await repository.save(row));
    } catch (error) { return sendDatabaseError(error, res, `Could not update ${resource.label.toLowerCase()}`); }
  };
  const remove = async (req, res) => {
    if (!isPositiveId(req.params.id)) return res.status(400).json({ error: 'id must be a positive integer' });
    try {
      const repository = AppDataSource.getRepository(resource.entity);
      const row = await repository.findOneBy({ id: req.params.id });
      if (!row) return res.status(404).json({ error: `${resource.label} not found` });
      await repository.remove(row);
      return res.json(row);
    } catch (error) { return sendDatabaseError(error, res, `Could not delete ${resource.label.toLowerCase()}`); }
  };
  for (const path of resource.paths) {
    app.get(path, authMiddleware, list);
    app.get(`${path}/:id`, authMiddleware, getOne);
    app.post(path, authMiddleware, create);
    app.put(`${path}/:id`, authMiddleware, replace);
    app.patch(`${path}/:id`, authMiddleware, update);
    app.delete(`${path}/:id`, authMiddleware, remove);
  }
}

for (const resource of resources) registerResourceRoutes(resource);

app.get('/', (_req, res) => {
  return res.json({
    message: 'Task 7 API is running',
    routes: ['/register', '/login', '/profile', '/sellers', '/products', '/seller_products', '/health']
  });
});

app.post('/register', register);
app.post('/signup', register);
app.post('/sign-up', register);
app.post('/login', login);
app.post('/signin', login);
app.get('/profile', authMiddleware, getProfile);

app.get('/health', async (req, res) => {
  try {
    await Promise.all([
      ensureUsersTable(),
      AppDataSource.isInitialized ? Promise.resolve() : AppDataSource.initialize()
    ]);
    return res.json({ status: 'ok' });
  } catch (error) {
    return res.status(500).json({ error: 'Database unavailable' });
  }
});

(async () => {
  try {
    await ensureUsersTable();
  } catch (error) {
    console.warn('Database not ready yet; server will still start.', error.message);
  }

  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
})();

module.exports = app;
