import Discord from '@auth/core/providers/discord';
import Google from '@auth/core/providers/google';
import { defineConfig } from 'auth-astro';
import { prisma } from './src/lib/db';

export default defineConfig({
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
  callbacks: {
    jwt: async ({ token, user }: any) => {
      if (user) {
        if (user.image) token.picture = user.image;
        if (user.name) token.name = user.name;
        const email = token.email;
        if (email) {
          const dbUser = await prisma.user.upsert({
            where: { email },
            update: {
              name: user.name ?? undefined,
              image: user.image ?? undefined,
            },
            create: {
              email,
              name: user.name ?? null,
              image: user.image ?? null,
            },
          });
          token.dbUserId = dbUser.id;
        }
      }
      return token;
    },
    session: ({ session, token }: any) => ({
      ...session,
      user: {
        ...session.user,
        id: (token as any).dbUserId ?? token.sub,
        image: (token as any).picture ?? session.user?.image ?? null,
        name: token.name ?? session.user?.name ?? null,
      },
    }),
  },
});
