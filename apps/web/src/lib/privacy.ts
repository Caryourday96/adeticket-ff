export type ConsentApi = {
  callbackQueue?: { push(callback: () => void): unknown };
  showRevocationMessage?: () => void;
};

// The CMP may still be loading when clicked. Resolve its method inside the queue.
export function reopenPrivacy(fc: ConsentApi | undefined): boolean {
  if (!fc?.callbackQueue) return false;
  fc.callbackQueue.push(() => fc.showRevocationMessage?.());
  return true;
}
