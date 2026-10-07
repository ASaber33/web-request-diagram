const { DataSource } = require('typeorm');
require('dotenv').config();
const Seller = require('./seller');
const Product = require('./product');
const SellerProduct = require('./sellerProduct');

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'clients_db',
  synchronize: false,
  logging: false,
  entities: [Seller, Product, SellerProduct],
  migrations: [],
  subscribers: [],
});

module.exports = AppDataSource;
