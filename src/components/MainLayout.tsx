"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import "@/styles/globals.css";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { data: session, status } = useSession();

  const navLinks = [
    { name: "Задачи", href: "/tasks", roles: ["ADMIN", "EXECUTOR", "UCH"] },
    { name: "Пользователи", href: "/users", roles: ["ADMIN"] },
    { name: "Типы задач", href: "/task-types", roles: ["ADMIN"] },
    { name: "Направления", href: "/task-directions", roles: ["ADMIN"] },
    { name: "Ставки", href: "/rates", roles: ["ADMIN", "UCH"] },
    { name: "Отчеты", href: "/work-reports", roles: ["ADMIN", "EXECUTOR", "UCH"] },
    { name: "Выплаты", href: "/salary", roles: ["ADMIN", "EXECUTOR", "UCH"] },
    { name: "Логи", href: "/logs", roles: ["ADMIN"] },
  ];

  const filteredLinks = navLinks.filter(link => 
    session?.user && link.roles.includes((session.user as any).role)
  );

  return (
    <div className="min-h-screen">
      {session && (
        <nav className="nav">
          <Link href="/" className="logo" style={{ fontWeight: 800, fontSize: '1.5rem', background: 'linear-gradient(45deg, var(--primary), var(--secondary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            BIZ-AUTO
          </Link>
          <div className="nav-links">
            {filteredLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`nav-link ${pathname === link.href ? "active" : ""}`}
              >
                {link.name}
              </Link>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              {session.user?.name}
            </span>
            <button onClick={() => signOut({ callbackUrl: '/login' })} className="nav-link" style={{ background: 'none', border: 'none', padding: 0 }}>
              Выйти
            </button>
          </div>
        </nav>
      )}
      <main className={session ? "container" : ""}>
        {children}
      </main>
    </div>
  );
}
