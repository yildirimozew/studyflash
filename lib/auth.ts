import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";

const isDemoMode = process.env.DEMO_MODE === "true";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          }),
        ]
      : []),
    ...(isDemoMode
      ? [
          Credentials({
            name: "Demo Login",
            credentials: {
              email: { label: "Email", type: "email" },
            },
            async authorize(credentials) {
              if (!credentials?.email) return null;
              const user = await prisma.user.findUnique({
                where: { email: credentials.email as string },
              });
              if (!user) return null;
              return {
                id: user.id,
                name: user.name,
                email: user.email,
                image: user.avatarUrl,
              };
            },
          }),
        ]
      : []),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google" && user.email) {
        const existing = await prisma.user.findUnique({
          where: { email: user.email },
        });
        if (!existing) {
          await prisma.user.create({
            data: {
              email: user.email,
              name: user.name || "Unknown",
              avatarUrl: user.image,
              role: "AGENT",
            },
          });
        }
      }
      return true;
    },
    async session({ session }) {
      if (session.user?.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: session.user.email },
        });
        if (dbUser) {
          session.user.id = dbUser.id;
          (session.user as unknown as Record<string, unknown>).role = dbUser.role;
        }
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
  trustHost: true,
});
