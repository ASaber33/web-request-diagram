const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { after, before, test } = require("node:test");
const { createServer } = require("./server");

let server;
let baseUrl;
let databaseDirectory;

before(async () => {
    databaseDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "http-contract-demo-"));
    server = createServer({
        dbPath: path.join(databaseDirectory, "users.json"),
        productsDbPath: path.join(databaseDirectory, "products.json")
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
    await new Promise((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
    });
    fs.rmSync(databaseDirectory, { recursive: true, force: true });
});

test("GET / redirects to /home", async () => {
    const response = await fetch(`${baseUrl}/`, { redirect: "manual" });

    assert.equal(response.status, 302);
    assert.equal(response.headers.get("location"), "/home");
});

test("GET /home returns the home page data", async () => {
    const response = await fetch(`${baseUrl}/home`);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
        page: "home",
        message: "Welcome home"
    });
});

test("GET /user returns multiple users", async () => {
    const response = await fetch(`${baseUrl}/user`);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
        users: [
            { id: 1, name: "Ahmed Saber", role: "student" },
            { id: 2, name: "Mona Ali", role: "designer" },
            { id: 3, name: "Omar Hassan", role: "developer" }
        ]
    });
});

test("POST /user saves a new user and returns it", async () => {
    const response = await fetch(`${baseUrl}/user`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Lina Noor", role: "tester", id: 999 })
    });

    assert.equal(response.status, 201);
    assert.equal(response.headers.get("location"), "/user");
    assert.deepEqual(await response.json(), {
        id: 4,
        name: "Lina Noor",
        role: "tester"
    });

    const savedResponse = await fetch(`${baseUrl}/user`);
    const savedData = await savedResponse.json();
    assert.equal(savedData.users.at(-1).name, "Lina Noor");
});

test("POST /user rejects invalid JSON", async () => {
    const response = await fetch(`${baseUrl}/user`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not json"
    });

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "Request body must be valid JSON" });
});

test("GET /product returns multiple products", async () => {
    const response = await fetch(`${baseUrl}/product`);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
        products: [
            { id: 101, name: "HTTP Starter Kit", price: 25 },
            { id: 102, name: "Node.js Essentials", price: 30 },
            { id: 103, name: "API Testing Guide", price: 20 }
        ]
    });
});

test("POST /product saves a new product and returns it", async () => {
    const response = await fetch(`${baseUrl}/product`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Backend Basics", price: 35, id: 999 })
    });

    assert.equal(response.status, 201);
    assert.equal(response.headers.get("location"), "/product");
    assert.deepEqual(await response.json(), {
        id: 104,
        name: "Backend Basics",
        price: 35
    });

    const savedResponse = await fetch(`${baseUrl}/product`);
    const savedData = await savedResponse.json();
    assert.equal(savedData.products.at(-1).name, "Backend Basics");
});

test("an unknown route returns 404", async () => {
    const response = await fetch(`${baseUrl}/missing`);

    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: "Route not found" });
});

test("a non-GET request to a known route returns 405", async () => {
    const response = await fetch(`${baseUrl}/home`, { method: "POST" });

    assert.equal(response.status, 405);
    assert.equal(response.headers.get("allow"), "GET");
});
