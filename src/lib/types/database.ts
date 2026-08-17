// Placeholder until the remote Supabase project exists and we run:
//   supabase gen types typescript --project-id <ref> > src/lib/types/database.ts
// Using `any` here keeps createBrowserClient/createServerClient typed loosely
// but functional in the meantime — application code should import from
// ./domain.ts (the stable product-level contract), not this file, directly.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any;
