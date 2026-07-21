// A tiny pub/sub so the global mutation-error interceptor (which lives outside
// React, in the QueryClient config) can ask the mounted ReadOnlyToast to show
// itself. Kept module-level and framework-free on purpose.

type Listener = () => void;

const listeners = new Set<Listener>();

export function subscribeReadOnlyToast(cb: Listener): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function fireReadOnlyToast(): void {
  listeners.forEach((cb) => cb());
}
