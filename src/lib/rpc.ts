export interface ShellyConfig {
  ip: string;
  username: string;
  password: string;
}

export interface RpcClient {
  /** Calls a device RPC method and returns its `result`. Throws on error. */
  call<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T>;
}

/**
 * Builds a client bound to a device config. All calls go through the
 * server-side proxy at /api/shelly/rpc, so credentials never leave the server
 * and there are no CORS issues talking to the device.
 */
export function createRpcClient(config: ShellyConfig): RpcClient {
  return {
    async call<T = unknown>(method: string, params?: Record<string, unknown>) {
      const res = await fetch("/api/shelly/rpc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...config, method, params }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      return body as T;
    },
  };
}
