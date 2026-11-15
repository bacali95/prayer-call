import type { ReactElement } from "react";
import { render } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { vi } from "vitest";
import { ThemeProvider } from "@/hooks/use-theme";
import { createQueryClient } from "@/lib/query-client";
import { Toaster } from "@/components/ui/toaster";

export interface MockCall {
  method: string;
  path: string;
  body: unknown;
}

type Handler = (call: MockCall) => unknown | { status: number; body: unknown };

/** Stubs fetch. Handlers are keyed "METHOD /path" (path without /api, query string included). */
export function mockFetch(handlers: Record<string, Handler>) {
  const calls: MockCall[] = [];
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost");
    const method = init?.method ?? "GET";
    const path = url.pathname.replace(/^\/api/, "") + url.search;
    const call: MockCall = { method, path, body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined };
    calls.push(call);
    const handler = handlers[`${method} ${path}`] ?? handlers[`${method} ${url.pathname.replace(/^\/api/, "")}`];
    if (!handler) return new Response(JSON.stringify({ error: `unmocked ${method} ${path}` }), { status: 404 });
    const result = handler(call) as { __status?: number; body?: unknown } | unknown;
    if (result && typeof result === "object" && "__status" in result) {
      const r = result as { __status: number; body: unknown };
      return new Response(JSON.stringify(r.body), { status: r.__status });
    }
    return new Response(JSON.stringify(result), { status: 200 });
  });
  vi.stubGlobal("fetch", fn);
  return calls;
}

export const fail = (status: number, error: string) => ({ __status: status, body: { error } });

export function renderWithProviders(ui: ReactElement) {
  return render(
    <ThemeProvider>
      <QueryClientProvider client={createQueryClient({ retry: false })}>
        <MemoryRouter>{ui}</MemoryRouter>
        <Toaster />
      </QueryClientProvider>
    </ThemeProvider>,
  );
}

export const baseConfig = {
  mosque: { uuid: "m1", id: "m1", name: "Al Fath", address: "Alphen" },
  chromecast: { uuid: "c1", name: "Hall speaker", model_name: "Nest Mini", cast_type: "audio" },
  adhan_files: { fajr: "adhan-fajr.mp3", dhuhr: "adhan.mp3", asr: "adhan.mp3", maghrib: "adhan.mp3", isha: null },
  adhan_volumes: { fajr: 0.5, dhuhr: 0.6, asr: 0.6, maghrib: 0.7, isha: null },
  prayer_times: { fajr: "06:12", shuruq: "07:58", dhuhr: "12:21", asr: "14:19", maghrib: "16:38", isha: "18:12" },
  unsplash_configured: true,
};

export const baseFiles = { files: [{ name: "adhan.mp3", size: 2_000_000 }, { name: "adhan-fajr.mp3", size: 3_000_000 }] };
