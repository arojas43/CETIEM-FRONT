import { NextRequest, NextResponse } from "next/server";
import type { ZodSchema, ZodError } from "zod";

function formatError(err: ZodError) {
  return err.issues.map(i => ({ path: i.path.join("."), message: i.message }));
}

export interface Schemas<B = unknown, Q = unknown> {
  body?: ZodSchema<B>;
  query?: ZodSchema<Q>;
}

/**
 * Wraps a Next.js 15 App Router handler with Zod validation.
 * If validation fails, responds with 400 { error: "ValidationError", issues: [...] }.
 * The handler receives `validated: { body, query }` as a second argument.
 *
 * Usage:
 *   export const POST = withValidation({ body: mySchema })(
 *     async (req, { body }, ctx) => { ... }
 *   );
 */
export function withValidation<B = unknown, Q = unknown>(schemas: Schemas<B, Q>) {
  return function <C>(
    handler: (
      req: NextRequest,
      validated: { body: B; query: Q },
      ctx: C
    ) => Promise<NextResponse>
  ) {
    return async (req: NextRequest, ctx: C): Promise<NextResponse> => {
      let parsedBody = undefined as unknown as B;
      let parsedQuery = undefined as unknown as Q;

      if (schemas.body) {
        let raw: unknown;
        try {
          raw = await req.json();
        } catch {
          return NextResponse.json(
            { error: "ValidationError", issues: [{ path: "", message: "Invalid JSON body" }] },
            { status: 400 }
          );
        }
        const result = schemas.body.safeParse(raw);
        if (!result.success) {
          return NextResponse.json(
            { error: "ValidationError", issues: formatError(result.error) },
            { status: 400 }
          );
        }
        parsedBody = result.data;
      }

      if (schemas.query) {
        const url = new URL(req.url);
        const raw = Object.fromEntries(url.searchParams.entries());
        const result = schemas.query.safeParse(raw);
        if (!result.success) {
          return NextResponse.json(
            { error: "ValidationError", issues: formatError(result.error) },
            { status: 400 }
          );
        }
        parsedQuery = result.data;
      }

      return handler(req, { body: parsedBody, query: parsedQuery }, ctx);
    };
  };
}
