"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

async function siteOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const protocol = h.get("x-forwarded-proto") ?? "https";
  return `${protocol}://${host}`;
}

export async function login(formData: FormData) {
  const supabase = await createClient();

  const email = String(formData.get("email"));
  const password = String(formData.get("password"));

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/auth/login?error=${encodeURIComponent(error.message)}`);
  }

  // Role-based dispatch (agency/admin -> /projects, homeowner -> /conversation
  // or onboarding) lives in the root page, not here — redirecting straight to
  // /conversation sent every agency/admin login into the homeowner route
  // group, where the layout has no membership row to find for them and
  // renders the "create your first project" onboarding screen meant for a
  // brand new homeowner instead.
  redirect("/");
}

export async function signup(formData: FormData) {
  const supabase = await createClient();

  const email = String(formData.get("email"));
  const password = String(formData.get("password"));

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${await siteOrigin()}/auth/confirm?next=/` },
  });

  if (error) {
    redirect(`/auth/login?error=${encodeURIComponent(error.message)}`);
  }

  // profiles row is created by the on-auth-user-created trigger (see migration);
  // if email confirmation is required, there's no session yet.
  if (!data.session) {
    redirect(
      `/auth/login?message=${encodeURIComponent("Check your email to confirm your account.")}`
    );
  }

  redirect("/");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/auth/login");
}
