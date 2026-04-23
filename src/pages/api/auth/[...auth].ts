import { Auth } from '@auth/core';
import Discord from '@auth/core/providers/discord';
import Google from '@auth/core/providers/google';
import type { APIRoute } from 'astro';

const authOptions = {
  basePath: '/api/auth',
  providers: [
    Google({
      clientId: import.meta.env.AUTH_GOOGLE_ID,
      clientSecret: import.meta.env.AUTH_GOOGLE_SECRET,
    }),
    Discord({
      clientId: import.meta.env.AUTH_DISCORD_ID,
      clientSecret: import.meta.env.AUTH_DISCORD_SECRET,
    }),
  ],
  secret: import.meta.env.AUTH_SECRET,
  trustHost: true,
  callbacks: {
    session: ({ session, token }: any) => ({
      ...session,
      user: {
        ...session.user,
        id: token.sub,
      },
    }),
  },
};

export const GET: APIRoute = async ({ request }) => {
  return Auth(request, authOptions);
};

export const POST: APIRoute = async ({ request }) => {
  return Auth(request, authOptions);
};
