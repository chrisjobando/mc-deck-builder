import type { APIContext } from 'astro';

export async function getUser(context: APIContext) {
  try {
    // Fetch session from Auth.js endpoint
    const response = await fetch(new URL('/api/auth/session', context.url), {
      headers: {
        cookie: context.request.headers.get('cookie') || '',
      },
    });

    if (!response.ok) {
      return null;
    }

    const session = await response.json();
    return session?.user ?? null;
  } catch {
    return null;
  }
}

export async function requireAuth(context: APIContext) {
  const user = await getUser(context);
  if (!user) {
    return context.redirect('/api/auth/signin');
  }
  return user;
}
