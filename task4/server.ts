import * as http from "node:http";
import { createApp, type CreateAppOptions } from "./app";

export function createServer(options: CreateAppOptions = {}): http.Server {
    return http.createServer(createApp(options));
}

export function startServer(port = Number(process.env.PORT) || 3000): http.Server {
    const server = createServer();

    server.listen(port, () => {
        console.log(`Server listening at http://localhost:${port}`);
    });

    return server;
}

if (require.main === module) {
    startServer();
}
