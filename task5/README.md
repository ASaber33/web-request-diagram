# Clients API

This is a small Express API connected to the existing `clients_db` PostgreSQL database.
It works with the `sellers`, `products`, and `seller_products` tables.

## Before running

Install the packages:

```powershell
npm install
```

Add your PostgreSQL settings to `.env`:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=clients_db
PORT=3100
```

Then start the server:

```powershell
npm start
```

The server runs at `http://localhost:3100` unless a different `PORT` is set.

## Tables used

- `sellers`: `id`, `seller_name`, `email`
- `products`: `id`, `seller_id`, `product`, `added_at`
- `seller_products`: `id`, `seller_name`, `email`, `product`, `price`, `added_at`

`products.seller_id` must match an existing seller.

## Routes

Each resource has the same operations:

| Method | Example | What it does |
| --- | --- | --- |
| GET | `/sellers` | Get all rows |
| GET | `/sellers?search=ahmed` | Search rows |
| GET | `/sellers/1` | Get one row by id |
| POST | `/sellers` | Create a row |
| PUT | `/sellers/1` | Replace all editable fields |
| PATCH | `/sellers/1` | Update only sent fields |
| DELETE | `/sellers/1` | Delete a row |

The same routes are available for `/products` and `/seller_products`.
`/seller-products` is also accepted as an alias for `/seller_products`.

Search is case-insensitive. `?q=word` can be used instead of `?search=word`.

## Search details

Seller search returns one row for each product that belongs to the matching seller:

```text
GET /sellers?search=ahmed
```

Each row includes `seller_id`, `seller_name`, `email`, `product_id`, `product`,
`price`, and `added_at`.

Product search includes the product and its seller:

```text
GET /products?search=mouse
```

Each row includes `product_id`, `product`, `price`, `added_at`, `seller_id`,
`seller_name`, and `email`.

At the moment, `price` is stored in `seller_products`, so the search queries use
that table for the price value.

## Request examples

Create a seller:

```json
POST /sellers
{
  "seller_name": "Ahmed Store",
  "email": "ahmed@example.com"
}
```

Create a product:

```json
POST /products
{
  "seller_id": 1,
  "product": "Wireless mouse"
}
```

Replace a product with `PUT`:

```json
PUT /products/1
{
  "seller_id": 1,
  "product": "Mechanical keyboard"
}
```

Update only a product name with `PATCH`:

```json
PATCH /products/1
{
  "product": "Compact mechanical keyboard"
}
```

Create a seller-product record with a price:

```json
POST /seller_products
{
  "seller_name": "Ahmed Store",
  "email": "ahmed@example.com",
  "product": "Wireless mouse",
  "price": 250.00
}
```

The database creates the `id` value for new rows. Do not send `id` or `added_at` in a request body.
