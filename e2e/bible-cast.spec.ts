import { expect, test } from "@playwright/test";

const namespace = "urn:x-cast:com.adeticket.bibleblitz";
const legacy = "urn:x-cast:com.naijafeud.audience";
const requestId = "aeb59dad-2392-42dd-aacb-533648555be4";

test("shared receiver validates Bible selection and iframe acknowledgements while preserving Friends Showdown", async ({
  page,
}) => {
  // Mock only the hardware SDK; the actual receiver component and cross-origin iframe run.
  await page.addInitScript(() => {
    const handlers = new Map<string, (event: { data: unknown; senderId: string }) => void>();
    const sent: unknown[] = [];
    const context = {
      addCustomMessageListener: (
        name: string,
        handler: (event: { data: unknown; senderId: string }) => void,
      ) => handlers.set(name, handler),
      sendCustomMessage: (name: string, senderId: string, message: unknown) =>
        sent.push({ name, senderId, message }),
      start: () => {},
    };
    Object.assign(window, {
      cast: { framework: { CastReceiverContext: { getInstance: () => context } } },
      testReceiver: {
        sent,
        namespaces: () => [...handlers.keys()],
        select: (name: string, data: unknown) =>
          handlers.get(name)?.({ data, senderId: "host-sender" }),
      },
    });
  });
  await page.route("https://adeticket.com/bibleblitz/tv?**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><title>Display fixture</title><h1>Public game board</h1>",
    }),
  );
  await page.goto("/cast");
  await expect
    .poll(() => page.evaluate(() => (window as any).testReceiver.namespaces()))
    .toEqual([legacy, namespace]);
  const select = (name: string, data: unknown) =>
    page.evaluate(({ name, data }) => (window as any).testReceiver.select(name, data), {
      name,
      data,
    });
  await select(namespace, { type: "SHOW_ROOM", room: "https://unrelated.example", requestId });
  await expect(page.locator("iframe")).toHaveCount(0);
  await select(namespace, {
    type: "SHOW_ROOM",
    room: "ABC234",
    requestId,
    url: "https://unrelated.example",
    hostToken: "must-not-forward",
  });
  const frame = page.locator('iframe[title="Bible Blitz TV display"]');
  const url = `https://adeticket.com/bibleblitz/tv?room=ABC234&requestId=${requestId}`;
  await expect(frame).toHaveAttribute("src", url);
  await expect(frame).toHaveAttribute("sandbox", "allow-scripts allow-same-origin");
  await expect(
    page.frameLocator("iframe").getByRole("heading", { name: "Public game board" }),
  ).toBeVisible();
  const display = page.frame({ url })!;
  const valid = { type: "DISPLAY_STATUS", room: "ABC234", requestId, status: "ready" };
  // Same schema from the wrong source/origin is ignored.
  await page.evaluate((message) => window.postMessage(message, "*"), valid);
  await display.evaluate(
    (message) =>
      parent.postMessage({ ...message, requestId: "bcb59dad-2392-42dd-aacb-533648555be4" }, "*"),
    valid,
  );
  await display.evaluate(
    (message) => parent.postMessage({ ...message, status: "unexpected" }, "*"),
    valid,
  );
  // The wildcard is only a fixture for the local parent; production uses the exact ff origin.
  await display.evaluate((message) => parent.postMessage(message, "*"), valid);
  await expect
    .poll(() => page.evaluate(() => (window as any).testReceiver.sent))
    .toEqual([{ name: namespace, senderId: "host-sender", message: valid }]);
  await select(legacy, { type: "SHOW_ROOM", room: "ABC123" });
  await expect(frame).toHaveCount(0);
});
