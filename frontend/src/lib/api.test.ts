import { afterEach, describe, expect, it, vi } from "vitest";
import { api, ApiError, request } from "@/lib/api";

afterEach(() => vi.unstubAllGlobals());

function stub(status: number, body: unknown) {
  const fn = vi.fn<(...args: unknown[]) => Promise<Response>>(async () => new Response(typeof body === "string" ? body : JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

describe("request", () => {
  it("returns parsed JSON on success", async () => {
    stub(200, { a: 1 });
    await expect(request("/x")).resolves.toEqual({ a: 1 });
  });

  it("throws ApiError carrying status and the backend error message", async () => {
    stub(409, { error: "A file named x.mp3 already exists" });
    const err = await request("/files").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(409);
    expect((err as ApiError).message).toBe("A file named x.mp3 already exists");
  });

  it("falls back to a generic message for non-JSON error bodies", async () => {
    stub(502, "<html>Bad gateway</html>");
    await expect(request("/x")).rejects.toMatchObject({ status: 502, message: "Request failed (502)" });
  });

  it("reports network failures with status 0", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("offline"))));
    await expect(request("/x")).rejects.toMatchObject({ status: 0 });
  });
});

describe("api path encoding", () => {
  it("encodes path params", async () => {
    const fn = stub(200, {});
    await api.deleteFile("my adhan/../x.mp3");
    expect(fn.mock.calls[0]).toEqual(["/api/files/my%20adhan%2F..%2Fx.mp3", { method: "DELETE" }]);
    await api.getCronLogs("fajr?x=1");
    expect(fn.mock.calls[1][0]).toBe("/api/cron/jobs/fajr%3Fx%3D1/logs");
    await api.getPrayerTimes("a/b");
    expect(fn.mock.calls[2][0]).toBe("/api/mosques/a%2Fb/prayer-times");
  });

  it("encodes query params and posts JSON", async () => {
    const fn = stub(200, { mosques: [] });
    await api.searchMosques("al fath & co");
    expect(fn.mock.calls[0][0]).toBe("/api/mosques/search?q=al+fath+%26+co");
    stub(200, {});
    const post = stub(200, {});
    await api.updateConfig({ adhan_volumes: { fajr: 0.4 } });
    const init = post.mock.calls[0] as unknown as [string, RequestInit];
    expect(init[1].method).toBe("POST");
    expect(JSON.parse(init[1].body as string)).toEqual({ adhan_volumes: { fajr: 0.4 } });
  });
});
