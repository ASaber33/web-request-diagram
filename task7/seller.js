const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
  name: 'Seller',
  tableName: 'sellers',
  columns: {
    id: {
      type: 'bigint',
      primary: true,
      generated: true
    },
    seller_name: {
      type: 'varchar'
    },
    email: {
      type: 'varchar'
    }
  }
});
