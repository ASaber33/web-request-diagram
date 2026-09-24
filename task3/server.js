const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { URL } = require("node:url");

const defaultUsers = [
    { id: 1, name: "Ahmed Saber", role: "student" },
    { id: 2, name: "Mona Ali", role: "designer" },
    { id: 3, name: "Omar Hassan", role: "developer" }
];

const defaultProducts = [
    { id: 101, name: "HTTP Starter Kit", price: 25 },
    { id: 102, name: "Node.js Essentials", price: 30 },
    { id: 103, name: "API Testing Guide", price: 20 }
];

const routes = {
    "/home": {
        status: 200,
        body: {
            page: "home",
            message: "Welcome home"
        }
    },
    "/user": {
        status: 200,
        body: null
    },
    "/product": {
        status: 200,
        body: null
    }
};

function loadCollection(dbPath, defaultEntries) {
    try {
        return JSON.parse(fs.readFileSync(dbPath, "utf8"));
    } catch (error) {
        if (error.code !== "ENOENT") {
            throw error;
        }

        fs.writeFileSync(dbPath, JSON.stringify(defaultEntries, null, 2));
        return structuredClone(defaultEntries);
    }
}

function addEntry(entries, dbPath, entryData) {
    const entry = {
        ...entryData,
        id: entries.reduce((highestId, currentEntry) => Math.max(highestId, currentEntry.id), 0) + 1
    };

    entries.push(entry);
    fs.writeFileSync(dbPath, JSON.stringify(entries, null, 2));
    return entry;
}

function readJsonBody(request) {
    return new Promise((resolve, reject) => {
        let body = "";

        request.setEncoding("utf8");
        request.on("data", (chunk) => {
            body += chunk;
        });
        request.on("end", () => {
            try {
                resolve(JSON.parse(body));
            } catch {
                reject(new Error("Request body must be valid JSON"));
            }
        });
        request.on("error", reject);
    });
}

function sendJson(response, statusCode, body, headers = {}) {
    const payload = JSON.stringify(body);

    response.writeHead(statusCode, {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Length": Buffer.byteLength(payload),
        ...headers
    });
    response.end(payload);
}

function createServer(options = {}) {
    const usersDbPath = options.dbPath ?? path.join(__dirname, "users.json");
    const productsDbPath = options.productsDbPath ?? path.join(__dirname, "products.json");
    const users = loadCollection(usersDbPath, defaultUsers);
    const products = loadCollection(productsDbPath, defaultProducts);

    return http.createServer((request, response) => {
        const method = request.method ?? "GET";
        const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
        const route = routes[url.pathname];

        if (method === "GET" && url.pathname === "/") {
            response.writeHead(302, { Location: "/home" });
            response.end();
            return;
        }

        if (!route) {
            sendJson(response, 404, {
                error: "Route not found"
            });
            return;
        }

        if (url.pathname === "/user" && method === "POST") {
            readJsonBody(request).then((userData) => {
                if (!userData || Array.isArray(userData) || typeof userData !== "object") {
                    sendJson(response, 400, { error: "User data must be a JSON object" });
                    return;
                }

                const user = addEntry(users, usersDbPath, userData);
                sendJson(response, 201, user, { Location: "/user" });
            }).catch((error) => {
                sendJson(response, 400, { error: error.message });
            });
            return;
        }

        if (url.pathname === "/product" && method === "POST") {
            readJsonBody(request).then((productData) => {
                if (!productData || Array.isArray(productData) || typeof productData !== "object") {
                    sendJson(response, 400, { error: "Product data must be a JSON object" });
                    return;
                }

                const product = addEntry(products, productsDbPath, productData);
                sendJson(response, 201, product, { Location: "/product" });
            }).catch((error) => {
                sendJson(response, 400, { error: error.message });
            });
            return;
        }

        if (method !== "GET") {
            sendJson(response, 405, {
                error: "Method not allowed"
            }, {
                Allow: ["/user", "/product"].includes(url.pathname) ? "GET, POST" : "GET"
            });
            return;
        }

        if (url.pathname === "/user") {
            sendJson(response, 200, { users });
            return;
        }

        if (url.pathname === "/product") {
            sendJson(response, 200, { products });
            return;
        }

        sendJson(response, route.status, route.body);
    });
}

function startServer(port = Number(process.env.PORT) || 3000) {
    const server = createServer();

    server.listen(port, () => {
        console.log(`Server listening at http://localhost:${port}`);
    });

    return server;
}

if (require.main === module) {
    startServer();
}

module.exports = { createServer, startServer };
