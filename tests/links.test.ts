import { expect, it } from "vitest";
import { gameOrigin } from "../apps/web/src/lib/links";

it("always creates production game links on the Adeticket domain", () => {
  expect(gameOrigin("ff.kayodeadetunji.com", "https://ff.kayodeadetunji.com")).toBe(
    "https://ff.adeticket.com",
  );
  expect(gameOrigin("naijafeud.kayodeadetunji.com", "https://naijafeud.kayodeadetunji.com")).toBe(
    "https://ff.adeticket.com",
  );
});

it("keeps local development links on the local host", () => {
  expect(gameOrigin("localhost", "http://localhost:3000")).toBe("http://localhost:3000");
  expect(gameOrigin("127.0.0.1", "http://127.0.0.1:3000")).toBe("http://127.0.0.1:3000");
});
