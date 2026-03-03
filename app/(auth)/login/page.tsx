"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const DEMO_USERS = [
  { email: "admin@studyflash.ch", name: "Sarah Admin", role: "Admin" },
  { email: "agent1@studyflash.ch", name: "Max Billing", role: "Billing Agent" },
  { email: "agent2@studyflash.ch", name: "Lena Tech", role: "Tech Agent" },
];

export default function LoginPage() {
  const [loading, setLoading] = useState<string | null>(null);

  const handleDemoLogin = async (email: string) => {
    setLoading(email);
    await signIn("credentials", { email, callbackUrl: "/" });
  };

  const handleGoogleLogin = async () => {
    setLoading("google");
    await signIn("google", { callbackUrl: "/" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">StudyFlash Support</CardTitle>
          <CardDescription>Sign in to the internal support platform</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {process.env.NEXT_PUBLIC_DEMO_MODE === "true" && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-muted-foreground">
                Demo Mode — Select a user
              </p>
              {DEMO_USERS.map((user) => (
                <Button
                  key={user.email}
                  variant="outline"
                  className="w-full justify-start gap-3 h-auto py-3"
                  disabled={loading !== null}
                  onClick={() => handleDemoLogin(user.email)}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-medium">
                    {user.name.charAt(0)}
                  </div>
                  <div className="text-left">
                    <div className="font-medium">{user.name}</div>
                    <div className="text-xs text-muted-foreground">{user.role}</div>
                  </div>
                  {loading === user.email && (
                    <span className="ml-auto text-xs text-muted-foreground">
                      Signing in...
                    </span>
                  )}
                </Button>
              ))}
            </div>
          )}

          {process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID && (
            <>
              {process.env.NEXT_PUBLIC_DEMO_MODE === "true" && (
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">or</span>
                  </div>
                </div>
              )}
              <Button
                className="w-full"
                onClick={handleGoogleLogin}
                disabled={loading !== null}
              >
                {loading === "google" ? "Signing in..." : "Sign in with Google"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
