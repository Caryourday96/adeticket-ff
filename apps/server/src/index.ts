import { resolve } from "node:path";
import { createApplication } from "./app";
if (process.env.NODE_ENV === "production" && !process.env.DATA_DIR)
  throw new Error("DATA_DIR must identify verified persistent storage in production.");
const server = createApplication({
  database: resolve(process.env.DATA_DIR ?? ".data", "showdown.sqlite"),
  password: process.env.HOST_PASSWORD,
  production: process.env.NODE_ENV === "production",
  origin: process.env.APP_ORIGIN,
});
const port = Number(process.env.PORT ?? 3000);
server.http.listen(port, "0.0.0.0", () =>
  console.log("Naija Family Showdown is ready at http://localhost:" + port),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    void server.close().then(() => process.exit(0));
  });
