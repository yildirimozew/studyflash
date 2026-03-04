import type { NextAuthConfig } from "next-auth";

// Edge-compatible auth config -- no Prisma imports allowed here.
// Used by middleware.ts which runs in the Edge Runtime.
// The full config (with Prisma callbacks) lives in lib/auth.ts.
export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnLogin = nextUrl.pathname.startsWith("/login");
      const isOnApi = nextUrl.pathname.startsWith("/api");

      if (isOnApi) return true;

      if (isOnLogin) {
        // Redirect already-authenticated users away from login
        if (isLoggedIn) return Response.redirect(new URL("/tickets", nextUrl));
        return true;
      }

      // All other routes require authentication
      if (!isLoggedIn) return false; // triggers redirect to pages.signIn

      return true;
    },
  },
  providers: [],
};
