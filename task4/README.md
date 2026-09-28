# Task 4: TypeScript Express CRUD API

This is a TypeScript and Express version of the Task 3 API. It supports creating, listing, updating, and deleting users and products. Task 3 is separate and was not changed.

Data is stored in `users.json` and `products.json`, so every POST, PUT, PATCH, and DELETE request persists after the server restarts.

## Requirements

- Node.js 18 or later
- npm

## Run the project

From this folder, install dependencies once (if needed), then start the server. The start command compiles TypeScript into `dist/` before starting the API:

```powershell
cd 4
npm install
npm start
```

The default base URL is `http://localhost:3000`.

To use another port in PowerShell:

```powershell
$env:PORT=4000
npm start
```

## Project files

| File | Purpose |
| --- | --- |
| `app.ts` | Express routes, TypeScript types, validation, and JSON-file persistence |
| `server.ts` | Starts the HTTP server |
| `users.json` | Persisted users |
| `products.json` | Persisted products |
| `server.test.ts` | Automated API tests |
| `tsconfig.json` | TypeScript compiler settings |
| `dist/` | Generated JavaScript output (created by `npm run build`) |

## API reference

| Method | Endpoint | Successful response |
| --- | --- | --- |
| GET | `/` | `302` redirect to `/home` |
| GET | `/home` | `200` with the home message |
| GET | `/user` | `200` with all users |
| POST | `/user` | `201` with the created user |
| PUT / PATCH | `/user/:id` | `200` with the updated user |
| DELETE | `/user/:id` | `204 No Content` |
| GET | `/product` | `200` with all products |
| POST | `/product` | `201` with the created product |
| PUT / PATCH | `/product/:id` | `200` with the updated product |
| DELETE | `/product/:id` | `204 No Content` |

### Important behavior

- Routes use singular names: `/user` and `/product`.
- The API generates IDs for POST requests. Any `id` included in a request body is ignored.
- PUT and PATCH both update only the fields sent in the JSON body. Omitted fields remain unchanged.
- There is no `GET /user/:id` or `GET /product/:id` route; use the collection GET route to see records.
- DELETE returns `204`, so Postman will show an empty response body.
- Requests that change data also change `users.json` or `products.json`. Create a disposable record first if you want repeatable testing.

## Using the API in Postman

### 1. Start the server

Keep this command running in a terminal:

```powershell
npm start
```

### 2. Create collection variables

1. Create a Postman collection named **Task 4 Express API**.
2. Open the collection's **Variables** tab.
3. Add the following variables:

| Variable | Initial value |
| --- | --- |
| `baseUrl` | `http://localhost:3000` |
| `userId` | Leave empty initially |
| `productId` | Leave empty initially |

Use `{{baseUrl}}` in every request URL. If you start the server on another port, update only `baseUrl`.

### 3. Send JSON request bodies

For every POST, PUT, or PATCH request:

1. Select the HTTP method.
2. Open **Body** and choose **raw**.
3. Choose **JSON** from the type selector.
4. Paste the request body.

Postman will add `Content-Type: application/json` automatically. You can also add that header manually in the **Headers** tab.

### 4. Users: create, update, and delete

First list the current users:

```text
GET {{baseUrl}}/user
```

Create a temporary user:

```text
POST {{baseUrl}}/user
```

```json
{
  "name": "Postman Test User",
  "role": "tester"
}
```

The response is `201 Created` and includes the generated `id`. Copy it to the `userId` collection variable. Or add this to the request's **Tests** tab to save it automatically:

```javascript
pm.test("User was created", () => {
    pm.response.to.have.status(201);
});

pm.collectionVariables.set("userId", pm.response.json().id);
```

Update all desired fields:

```text
PUT {{baseUrl}}/user/{{userId}}
```

```json
{
  "name": "Updated Postman User",
  "role": "API tester"
}
```

Or update only one field:

```text
PATCH {{baseUrl}}/user/{{userId}}
```

```json
{
  "role": "senior API tester"
}
```

Both update requests return `200 OK`. When finished, remove the temporary user:

```text
DELETE {{baseUrl}}/user/{{userId}}
```

The expected response is `204 No Content` with an empty body.

### 5. Products: create, update, and delete

List products:

```text
GET {{baseUrl}}/product
```

Create a temporary product:

```text
POST {{baseUrl}}/product
```

```json
{
  "name": "Postman Test Product",
  "price": 35
}
```

Copy the returned ID to `productId`, or use this **Tests** script:

```javascript
pm.test("Product was created", () => {
    pm.response.to.have.status(201);
});

pm.collectionVariables.set("productId", pm.response.json().id);
```

Update the product:

```text
PATCH {{baseUrl}}/product/{{productId}}
```

```json
{
  "price": 40
}
```

Delete the temporary product:

```text
DELETE {{baseUrl}}/product/{{productId}}
```

PATCH returns `200 OK`; DELETE returns `204 No Content`.

### Other useful requests

```text
GET {{baseUrl}}/home
GET {{baseUrl}}/
```

`GET /home` returns the home JSON response. `GET /` redirects to `/home`; Postman may follow the redirect automatically. Disable **Automatically follow redirects** in Postman settings to inspect the original `302` response.

## Error responses

| Situation | Status | Example response |
| --- | --- | --- |
| Invalid or non-positive ID | `400` | `{ "error": "ID must be a positive integer" }` |
| Invalid JSON | `400` | `{ "error": "Request body must be valid JSON" }` |
| Update body contains no fields except `id` | `400` | A resource-specific validation error |
| Record does not exist | `404` | `{ "error": "User not found" }` or `{ "error": "Product not found" }` |
| Unknown route | `404` | `{ "error": "Route not found" }` |
| Unsupported method | `405` | `{ "error": "Method not allowed" }` and an `Allow` header |

## Run tests

```powershell
npm test
```

The automated tests use temporary JSON files, so they do not modify the real data files in this folder.

## TypeScript commands

```powershell
# Compile TypeScript only
npm run build

# Check TypeScript types without creating files
npm run typecheck
```
