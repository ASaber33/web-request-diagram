const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
  name: 'Product',
  tableName: 'products',
  columns: {
    id: {
      type: 'bigint',
      primary: true,
      generated: true
    },
    seller_id: {
      type: 'bigint'
    },
    product: {
      type: 'varchar'
    },
    added_at: {
      type: 'timestamptz',
      default: () => 'CURRENT_TIMESTAMP'
    }
  }
});
