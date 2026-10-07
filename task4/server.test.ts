import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as http from "node:http";
import * as os from "node:os";
import * as path from "node:path";
import { after, before, test } from "node:test";
import { createServer } from "./server";

let server: http.Server;
let baseUrl = "";
let databaseDirectory = "";
let usersDbPath = "";
let productsDbPath = "";

before(async () => {
    databaseDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "task4-express-api-"));
    usersDbPath = path.join(databaseDirectory, "users.json");
    productsDbPath = path.join(databaseDirectory, "products.json");
    server = createServer({ dbPath: usersDbPath, productsDbPath });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();

    if (!address || typeof address === "string") {
        throw new Error("Test server did not expose a TCP port");
    }

    baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
    await new Promise<void>((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
    });
    fs.rmSync(databaseDirectory, { recursive: true, force: true });
});

test("home routes work", async () => {
    const redirect = await fetch(`${baseUrl}/`, { redirect: "manual" });
    assert.equal(redirect.status, 302);
    assert.equal(redirect.headers.get("location"), "/home");

    const home = await fetch(`${baseUrl}/home`);
    assert.equal(home.status, 200);
    assert.deepEqual(await home.json(), { page: "home", message: "Welcome home" });
});

test("user CRUD persists changes", async () => {
    const list = await fetch(`${baseUrl}/user`);
    assert.equal(list.status, 200);
    assert.equal((await list.json()).users.length, 3);

    const created = await fetch(`${baseUrl}/user`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Lina Noor", role: "tester", id: 999 })
    });
    assert.equal(created.status, 201);
    assert.deepEqual(await created.json(), { id: 4, name: "Lina Noor", role: "tester" });

    const updated = await fetch(`${baseUrl}/user/4`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "senior tester", id: 999 })
    });
    assert.equal(updated.status, 200);
    assert.deepEqual(await updated.json(), { id: 4, name: "Lina Noor", role: "senior tester" });
    assert.equal(JSON.parse(fs.readFileSync(usersDbPath, "utf8")).at(-1).role, "senior tester");

    const deleted = await fetch(`${baseUrl}/user/4`, { method: "DELETE" });
    assert.equal(deleted.status, 204);
    assert.equal(await deleted.text(), "");
});

test("product CRUD works", async () => {
    const created = await fetch(`${baseUrl}/product`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Backend Basics", price: 35 })
    });
    assert.equal(created.status, 201);
    assert.deepEqual(await created.json(), { id: 104, name: "Backend Basics", price: 35 });

    const updated = await fetch(`${baseUrl}/product/104`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ price: 40 })
    });
    assert.equal(updated.status, 200);
    assert.deepEqual(await updated.json(), { id: 104, name: "Backend Basics", price: 40 });

    const deleted = await fetch(`${baseUrl}/product/104`, { method: "DELETE" });
    assert.equal(deleted.status, 204);
});

test("API errors use the expected status codes", async () => {
    const invalidJson = await fetch(`${baseUrl}/user`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not json"
    });
    assert.equal(invalidJson.status, 400);
    assert.deepEqual(await invalidJson.json(), { error: "Request body must be valid JSON" });

    const invalidId = await fetch(`${baseUrl}/user/nope`, {
        method: "DELETE"
    });
    assert.equal(invalidId.status, 400);

    const missing = await fetch(`${baseUrl}/product/999`, { method: "DELETE" });
    assert.equal(missing.status, 404);

    const wrongMethod = await fetch(`${baseUrl}/home`, { method: "POST" });
    assert.equal(wrongMethod.status, 405);
    assert.equal(wrongMethod.headers.get("allow"), "GET");
});
