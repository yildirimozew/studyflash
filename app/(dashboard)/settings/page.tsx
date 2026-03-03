import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export default async function SettingsPage() {
  const users = await prisma.user.findMany({
    include: {
      _count: {
        select: { tickets: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Team Management</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {users.map((user) => (
          <Card key={user.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-sm">{user.name}</CardTitle>
                  <p className="text-xs text-muted-foreground truncate">
                    {user.email}
                  </p>
                </div>
                <Badge variant={user.role === "ADMIN" ? "default" : "secondary"}>
                  {user.role}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Assigned tickets</span>
                <span className="font-medium">{user._count.tickets}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
