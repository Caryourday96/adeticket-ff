import { expect, it, vi } from "vitest";
import { reopenPrivacy, type ConsentApi } from "../apps/web/src/lib/privacy";

it("queues reopening until the CMP has loaded its method", () => {
  const queue: (() => void)[] = [];
  const fc: ConsentApi = { callbackQueue: queue };
  expect(reopenPrivacy(fc)).toBe(true);
  const reopen = vi.fn();
  fc.showRevocationMessage = reopen;
  expect(reopen).not.toHaveBeenCalled();
  queue[0]();
  expect(reopen).toHaveBeenCalledOnce();
});
it("reports unavailable CMP without calling its API outside the queue", () => {
  const reopen = vi.fn();
  expect(reopenPrivacy(undefined)).toBe(false);
  expect(reopenPrivacy({ showRevocationMessage: reopen })).toBe(false);
  expect(reopen).not.toHaveBeenCalled();
});
