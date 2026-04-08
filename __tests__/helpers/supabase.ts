/**
 * Supabase mock builder for unit tests.
 *
 * Usage:
 *   const mock = createSupabaseMock({
 *     jobs: [{ data: { id: 'abc' }, error: null }],
 *     invoices: [{ data: null, error: null }, { data: { id: 'inv1' }, error: null }],
 *   });
 *
 * Each table entry is a queue. Every call to .from('table') pops the next
 * response off the queue (or returns { data: null, error: null } if empty).
 */

export type MockResponse = {
  data?: any;
  error?: any;
  count?: number | null;
};

/**
 * Build a fluent chainable Supabase query builder stub that resolves to `response`.
 * The chain is itself awaitable (for queries that don't end in .single()).
 */
export function buildChain(response: MockResponse) {
  const resolved = Promise.resolve(response);
  const chain: any = {
    select:      jest.fn().mockReturnThis(),
    insert:      jest.fn().mockReturnThis(),
    update:      jest.fn().mockReturnThis(),
    delete:      jest.fn().mockReturnThis(),
    upsert:      jest.fn().mockReturnThis(),
    eq:          jest.fn().mockReturnThis(),
    neq:         jest.fn().mockReturnThis(),
    in:          jest.fn().mockReturnThis(),
    is:          jest.fn().mockReturnThis(),
    order:       jest.fn().mockReturnThis(),
    limit:       jest.fn().mockReturnThis(),
    head:        jest.fn().mockReturnThis(),
    single:      jest.fn().mockResolvedValue(response),
    maybeSingle: jest.fn().mockResolvedValue(response),
    // Make the builder itself awaitable (e.g. for count queries)
    then:    (res: any, rej?: any) => resolved.then(res, rej),
    catch:   (rej: any)            => resolved.catch(rej),
    finally: (fin: any)            => resolved.finally(fin),
  };
  return chain;
}

/**
 * Create a mock Supabase client whose `.from()` responses are driven by
 * per-table queues you supply.
 */
export function createSupabaseMock(
  responses: Record<string, MockResponse | MockResponse[]> = {}
) {
  // Normalize everything to queues
  const queues: Record<string, MockResponse[]> = {};
  for (const [table, val] of Object.entries(responses)) {
    queues[table] = Array.isArray(val) ? [...val] : [val];
  }

  const mock = {
    from: jest.fn((table: string) => {
      const queue = queues[table];
      const response =
        queue && queue.length > 0
          ? queue.shift()!
          : { data: null, error: null };
      return buildChain(response);
    }),
    auth: {
      signInWithPassword: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
      admin: {
        createUser:  jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
        deleteUser:  jest.fn().mockResolvedValue({ error: null }),
      },
    },
  };
  return mock;
}

/** Build a minimal NextRequest-like object for route handler tests. */
export function makeRequest(url: string, body: unknown) {
  const { NextRequest } = require("next/server");
  return new NextRequest(`http://localhost${url}`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });
}
