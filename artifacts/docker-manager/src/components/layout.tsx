import { Link, useLocation } from "wouter";
import { Activity, Box, HardDrive, Layers, Server } from "lucide-react";
import { cn } from "@/lib/utils";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "概览", icon: Activity },
    { href: "/ollama", label: "Ollama 管理", icon: Server },
    { href: "/containers", label: "容器管理", icon: Box },
    { href: "/images", label: "镜像管理", icon: Layers },
    { href: "/volumes", label: "数据卷管理", icon: HardDrive },
  ];

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside className="w-64 border-r border-sidebar-border bg-sidebar flex-shrink-0 fixed h-full z-10">
        <div className="p-6">
          <h1 className="text-xl font-bold text-cyan-400 flex items-center gap-2 font-mono">
            <Box className="w-6 h-6" />
            Docker 管理中心
          </h1>
        </div>
        <nav className="space-y-1 px-3">
          {navItems.map((item) => {
            const isActive = location === item.href;
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className="block">
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm font-medium cursor-pointer",
                    isActive
                      ? "bg-sidebar-accent text-cyan-400"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-cyan-400"
                  )}
                >
                  <Icon className="w-5 h-5" />
                  {item.label}
                </div>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-64 p-8 min-h-screen">
        <div className="max-w-6xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
