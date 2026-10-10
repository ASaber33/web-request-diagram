const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
  name: 'SellerProduct',
  tableName: 'seller_products',
  columns: {
    id: {
      type: 'bigint',
      primary: true,
      generated: true
    },
    seller_name: {
      type: 'varchar',
      length: 100
    },
    email: {
      type: 'varchar',
      length: 255
    },
    product: {
      type: 'varchar',
      length: 150
    },
    price: {
      type: 'numeric',
      precision: 10,
      scale: 2,
      default: 0
    },
    added_at: {
      type: 'timestamptz',
      default: () => 'CURRENT_TIMESTAMP'
    }
  }
});
