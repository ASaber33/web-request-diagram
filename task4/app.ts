import express, {
    type ErrorRequestHandler,
    type Express,
    type Request,
    type Response
} from "express";
import * as fs from "node:fs";
import * as path from "node:path";

export type Entry = Record<string, unknown> & { id: number };

export interface CreateAppOptions {
    dbPath?: string;
    usersDbPath?: string;
    productsDbPath?: string;
}

type ResourceName = "User" | "Product";

interface CollectionOptions {
    basePath: "/user" | "/product";
    collectionName: "users" | "products";
    resourceName: ResourceName;
    entries: Entry[];
    dbPath: string;
}

const defaultUsers: Entry[] = [
    { id: 1, name: "Ahmed Saber", role: "student" },
    { id: 2, name: "Mona Ali", role: "designer" },
    { id: 3, name: "Omar Hassan", role: "developer" }
];

const defaultProducts: Entry[] = [
    { id: 101, name: "HTTP Starter Kit", price: 25 },
    { id: 102, name: "Node.js Essentials", price: 30 },
    { id: 103, name: "API Testing Guide", price: 20 }
];

function saveCollection(dbPath: string, entries: Entry[]): void {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    fs.writeFileSync(dbPath, JSON.stringify(entries, null, 2));
}

function isMissingFileError(error: unknown): boolean {
    return typeof error === "object"
        && error !== null
        && "code" in error
        && (error as { code?: unknown }).code === "ENOENT";
}

function loadCollection(dbPath: string, defaultEntries: Entry[]): Entry[] {
    try {
        const parsed: unknown = JSON.parse(fs.readFileSync(dbPath, "utf8"));

        if (!Array.isArray(parsed)) {
            throw new Error(`${dbPath} must contain a JSON array`);
        }

        // Existing JSON files may contain additional fields, so their shape stays flexible.
        return parsed as Entry[];
    } catch (error: unknown) {
        if (!isMissingFileError(error)) {
            throw error;
        }

        const entries = structuredClone(defaultEntries);
        saveCollection(dbPath, entries);
        return entries;
    }
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

function getEntryId(value: unknown): number | null {
    if (typeof value !== "string" || !/^\d+$/.test(value)) {
        return null;
    }

    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function getRequestData(
    request: Request,
    response: Response,
    resourceName: ResourceName,
    requiresFields = false
): Record<string, unknown> | null {
    const body: unknown = request.body;

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

function registerCollectionRoutes(app: Express, options: CollectionOptions): void {
    const { basePath, collectionName, resourceName, entries, dbPath } = options;

    function listEntries(_request: Request, response: Response): void {
        response.json({ [collectionName]: entries });
    }

    function createEntry(request: Request, response: Response): void {
        const data = getRequestData(request, response, resourceName);

        if (!data) {
            return;
        }

        const nextId = entries.reduce(
            (highestId, entry) => Math.max(highestId, Number.isSafeInteger(entry.id) ? entry.id : 0),
            0
        ) + 1;
        const entry: Entry = { ...data, id: nextId };

        entries.push(entry);
        saveCollection(dbPath, entries);
        response.location(basePath).status(201).json(entry);
    }

    function updateEntry(request: Request, response: Response): void {
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

    function deleteEntry(request: Request, response: Response): void {
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

function getAllowedMethods(requestPath: string): string | null {
    const pathname = requestPath.replace(/\/+$/, "") || "/";

    if (pathname === "/" || pathname === "/home") {
        return "GET";
    }

    if (pathname === "/user" || pathname === "/product") {
        return "GET, POST";
    }

    return /^\/(user|product)\/[^/]+$/.test(pathname) ? "PUT, PATCH, DELETE" : null;
}

function isInvalidJsonError(error: unknown): boolean {
    return typeof error === "object"
        && error !== null
        && "type" in error
        && (error as { type?: unknown }).type === "entity.parse.failed";
}

export function createApp(options: CreateAppOptions = {}): Express {
    // app.ts is compiled to dist/app.js, so one level up is the project folder.
    const projectRoot = path.resolve(__dirname, "..");
    const usersDbPath = options.usersDbPath ?? options.dbPath ?? path.join(projectRoot, "users.json");
    const productsDbPath = options.productsDbPath ?? path.join(projectRoot, "products.json");
    const app = express();
    const users = loadCollection(usersDbPath, defaultUsers);
    const products = loadCollection(productsDbPath, defaultProducts);

    app.use(express.json());

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

    const errorHandler: ErrorRequestHandler = (error, _request, response, next) => {
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
