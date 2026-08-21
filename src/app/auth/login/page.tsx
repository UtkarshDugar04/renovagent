import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/shared/Logo";
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
          <Logo size="lg" className="mb-3 flex-col gap-3" />
          <p className="mt-1 text-sm text-muted-foreground">
            One continuously understood renovation.
          </p>
        </div>

        <Card className="p-6">
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {message && (
            <Alert className="mb-4 border-accent/30 bg-accent/10">
              <AlertDescription className="text-accent">{message}</AlertDescription>
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
              <Button type="submit" formAction={login} className="flex-1">
                Log in
              </Button>
              <Button type="submit" formAction={signup} variant="outline" className="flex-1">
                Sign up
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
