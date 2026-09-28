"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const assert = __importStar(require("node:assert/strict"));
const fs = __importStar(require("node:fs"));
const os = __importStar(require("node:os"));
const path = __importStar(require("node:path"));
const node_test_1 = require("node:test");
const server_1 = require("./server");
let server;
let baseUrl = "";
let databaseDirectory = "";
let usersDbPath = "";
let productsDbPath = "";
(0, node_test_1.before)(async () => {
    databaseDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "task4-express-api-"));
    usersDbPath = path.join(databaseDirectory, "users.json");
    productsDbPath = path.join(databaseDirectory, "products.json");
    server = (0, server_1.createServer)({ dbPath: usersDbPath, productsDbPath });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") {
        throw new Error("Test server did not expose a TCP port");
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
});
(0, node_test_1.after)(async () => {
    await new Promise((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
    });
    fs.rmSync(databaseDirectory, { recursive: true, force: true });
});
(0, node_test_1.test)("home routes work", async () => {
    const redirect = await fetch(`${baseUrl}/`, { redirect: "manual" });
    assert.equal(redirect.status, 302);
    assert.equal(redirect.headers.get("location"), "/home");
    const home = await fetch(`${baseUrl}/home`);
    assert.equal(home.status, 200);
    assert.deepEqual(await home.json(), { page: "home", message: "Welcome home" });
});
(0, node_test_1.test)("user CRUD persists changes", async () => {
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
(0, node_test_1.test)("product CRUD works", async () => {
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
(0, node_test_1.test)("API errors use the expected status codes", async () => {
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
//# sourceMappingURL=server.test.js.map