import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
    <div className="relative flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl glass glow-primary">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-gradient">Renovagent</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            One continuously understood renovation.
          </p>
        </div>

        <div className="glass rounded-2xl p-6">
          {error && (
            <Alert variant="destructive" className="mb-4 border-destructive/30 bg-destructive/10">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {message && (
            <Alert className="mb-4 border-accent/30 bg-accent/10">
              <AlertDescription className="text-accent-foreground">{message}</AlertDescription>
            </Alert>
          )}

          <form className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required autoComplete="email" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="current-password"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button formAction={login} className="flex-1 glow-primary">
                Log in
              </Button>
              <Button formAction={signup} variant="outline" className="flex-1">
                Sign up
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
