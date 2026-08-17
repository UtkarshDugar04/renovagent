import { login, signup } from "./actions";

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  return <LoginForm searchParamsPromise={searchParams} />;
}

async function LoginForm({
  searchParamsPromise,
}: {
  searchParamsPromise: Promise<{ error?: string; message?: string }>;
}) {
  const { error, message } = await searchParamsPromise;

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-2xl font-semibold text-stone-900">Renovagent</h1>
        <p className="mb-8 text-sm text-stone-500">
          One continuously understood renovation.
        </p>

        {error && (
          <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        {message && (
          <p className="mb-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {message}
          </p>
        )}

        <form className="space-y-3">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm text-stone-600">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-sm text-stone-600">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              formAction={login}
              className="flex-1 rounded-md bg-stone-900 px-3 py-2 text-sm font-medium text-white hover:bg-stone-800"
            >
              Log in
            </button>
            <button
              formAction={signup}
              className="flex-1 rounded-md border border-stone-300 px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100"
            >
              Sign up
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
