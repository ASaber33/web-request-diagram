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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
const express_1 = __importDefault(require("express"));
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
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
function saveCollection(dbPath, entries) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    fs.writeFileSync(dbPath, JSON.stringify(entries, null, 2));
}
function isMissingFileError(error) {
    return typeof error === "object"
        && error !== null
        && "code" in error
        && error.code === "ENOENT";
}
function loadCollection(dbPath, defaultEntries) {
    try {
        const parsed = JSON.parse(fs.readFileSync(dbPath, "utf8"));
        if (!Array.isArray(parsed)) {
            throw new Error(`${dbPath} must contain a JSON array`);
        }
        // Existing JSON files may contain additional fields, so their shape stays flexible.
        return parsed;
    }
    catch (error) {
        if (!isMissingFileError(error)) {
            throw error;
        }
        const entries = structuredClone(defaultEntries);
        saveCollection(dbPath, entries);
        return entries;
    }
}
function isJsonObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}
function getEntryId(value) {
    if (typeof value !== "string" || !/^\d+$/.test(value)) {
        return null;
    }
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
}
function getRequestData(request, response, resourceName, requiresFields = false) {
    const body = request.body;
    if (!isJsonObject(body)) {
        response.status(400).json({ error: `${resourceName} data must be a JSON object` });
        return null;
    }
    const { id: _ignoredId, ...data } = body;
    if (requiresFields && Object.keys(data).length === 0) {
        response.status(400).json({ error: `${resourceName} update data must include at least one field` });
        return null;
    }
    return data;
}
function registerCollectionRoutes(app, options) {
    const { basePath, collectionName, resourceName, entries, dbPath } = options;
    function listEntries(_request, response) {
        response.json({ [collectionName]: entries });
    }
    function createEntry(request, response) {
        const data = getRequestData(request, response, resourceName);
        if (!data) {
            return;
        }
        const nextId = entries.reduce((highestId, entry) => Math.max(highestId, Number.isSafeInteger(entry.id) ? entry.id : 0), 0) + 1;
        const entry = { ...data, id: nextId };
        entries.push(entry);
        saveCollection(dbPath, entries);
        response.location(basePath).status(201).json(entry);
    }
    function updateEntry(request, response) {
        const id = getEntryId(request.params.id);
        if (id === null) {
            response.status(400).json({ error: "ID must be a positive integer" });
            return;
        }
        const data = getRequestData(request, response, resourceName, true);
        if (!data) {
            return;
        }
        const index = entries.findIndex((entry) => entry.id === id);
        if (index === -1) {
            response.status(404).json({ error: `${resourceName} not found` });
            return;
        }
        entries[index] = { ...entries[index], ...data, id };
        saveCollection(dbPath, entries);
        response.json(entries[index]);
    }
    function deleteEntry(request, response) {
        const id = getEntryId(request.params.id);
        if (id === null) {
            response.status(400).json({ error: "ID must be a positive integer" });
            return;
        }
        const index = entries.findIndex((entry) => entry.id === id);
        if (index === -1) {
            response.status(404).json({ error: `${resourceName} not found` });
            return;
        }
        entries.splice(index, 1);
        saveCollection(dbPath, entries);
        response.status(204).send();
    }
    app.route(basePath).get(listEntries).post(createEntry);
    app.route(`${basePath}/:id`).put(updateEntry).patch(updateEntry).delete(deleteEntry);
}
function getAllowedMethods(requestPath) {
    const pathname = requestPath.replace(/\/+$/, "") || "/";
    if (pathname === "/" || pathname === "/home") {
        return "GET";
    }
    if (pathname === "/user" || pathname === "/product") {
        return "GET, POST";
    }
    return /^\/(user|product)\/[^/]+$/.test(pathname) ? "PUT, PATCH, DELETE" : null;
}
function isInvalidJsonError(error) {
    return typeof error === "object"
        && error !== null
        && "type" in error
        && error.type === "entity.parse.failed";
}
function createApp(options = {}) {
    // app.ts is compiled to dist/app.js, so one level up is the project folder.
    const projectRoot = path.resolve(__dirname, "..");
    const usersDbPath = options.usersDbPath ?? options.dbPath ?? path.join(projectRoot, "users.json");
    const productsDbPath = options.productsDbPath ?? path.join(projectRoot, "products.json");
    const app = (0, express_1.default)();
    const users = loadCollection(usersDbPath, defaultUsers);
    const products = loadCollection(productsDbPath, defaultProducts);
    app.use(express_1.default.json());
    app.get("/", (_request, response) => response.redirect(302, "/home"));
    app.get("/home", (_request, response) => {
        response.json({ page: "home", message: "Welcome home" });
    });
    registerCollectionRoutes(app, {
        basePath: "/user",
        collectionName: "users",
        resourceName: "User",
        entries: users,
        dbPath: usersDbPath
    });
    registerCollectionRoutes(app, {
        basePath: "/product",
        collectionName: "products",
        resourceName: "Product",
        entries: products,
        dbPath: productsDbPath
    });
    app.use((request, response) => {
        const allowedMethods = getAllowedMethods(request.path);
        if (allowedMethods) {
            response.set("Allow", allowedMethods).status(405).json({ error: "Method not allowed" });
            return;
        }
        response.status(404).json({ error: "Route not found" });
    });
    const errorHandler = (error, _request, response, next) => {
        if (isInvalidJsonError(error)) {
            response.status(400).json({ error: "Request body must be valid JSON" });
            return;
        }
        if (response.headersSent) {
            next(error);
            return;
        }
        response.status(500).json({ error: "Internal server error" });
    };
    app.use(errorHandler);
    return app;
}
//# sourceMappingURL=app.js.map