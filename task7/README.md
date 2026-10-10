# Task 7: Accounts and Catalog API

This project exposes a JSON API for account registration, login, and a protected profile. Use the Postman collection at `postman/collections/accounts.postman_collection.json` to try the endpoints.

## Setup

1. Install dependencies with `npm install`.
2. Configure `.env` with the PostgreSQL connection values and `JWT_SECRET`. Use a random secret at least 32 bytes long. The database defaults to `clients_db`.
3. Start the API with `npm start`. It listens on port `3100` by default.
4. Import the Postman collection. Run **Create account**, then **Login**, then **Get protected profile**. The Login request saves its token to the collection variable automatically.

## Endpoints

### `POST /register`

```json
{
  "username": "Student",
  "email": "student@example.com",
  "password": "example-pass-123"
}
```

Passwords are required and must be no more than 72 UTF-8 bytes. Passwords are stored as bcrypt hashes. A duplicate email returns `409`.

### `POST /login`

```json
{
  "email": "student@example.com",
  "password": "example-pass-123"
}
```

On success, the response includes a signed Bearer token that expires after 24 hours. Invalid credentials return `401`.

### `GET /profile`

Send `Authorization: Bearer <token>` from the login response. Returns the authenticated user's public profile. Missing or invalid tokens return `401`.

### `GET /health`

Checks database availability and ensures the `users` table exists.

## Sellers and products

The catalog API from task6 is also available. It uses the `sellers`, `products`, and `seller_products` tables in the same PostgreSQL database. Those tables must already exist; TypeORM synchronization is disabled.

- `GET /sellers`, `/products`, `/seller_products` list records. Add `?search=value` (or `?q=value`) to search.
- `GET /sellers/:id`, `/products/:id`, `/seller_products/:id` reads one record.
- `POST` creates, `PUT` replaces, `PATCH` updates, and `DELETE` removes a record at each collection path.
- `/seller-products` is an alias for `/seller_products`.

All catalog routes require a login token. Register with `POST /register`, then log in with `POST /login`. Copy the returned `token` and send it with each catalog request as `Authorization: Bearer <token>`.

See [TASK6_README.md](TASK6_README.md) for the request body fields and examples. The original Task 6 source is unchanged.
