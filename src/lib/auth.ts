import { getSession } from 'auth-astro/server';
import type { APIContext } from 'astro';

export async function getUser(context: APIContext) {
  const session = await getSession(context.request);
  return session?.user ?? null;
}

export async function requireAuth(context: APIContext) {
  const user = await getUser(context);
  if (!user) {
    return context.redirect('/api/auth/signin');
  }
  return user;
}
