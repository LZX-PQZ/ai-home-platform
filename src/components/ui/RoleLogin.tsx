"use client";
import { usePathname } from "next/navigation";
import { OwnerLogin } from "@/components/ui/OwnerLogin";
import { StaffLogin } from "@/components/ui/StaffLogin";

export function RoleLogin({ onStatusChange }: { onStatusChange?: (signedIn: boolean) => void }) {
  const path = usePathname();
  if (path === "/provider" || path.startsWith("/provider/") || path === "/login/provider") return <StaffLogin key="provider" role="provider" onStatusChange={onStatusChange} />;
  if (path === "/admin" || path.startsWith("/admin/") || path === "/login/admin") return <StaffLogin key="admin" role="admin" onStatusChange={onStatusChange} />;
  if (path === "/owner" || path.startsWith("/owner/")) return <OwnerLogin onStatusChange={onStatusChange} />;
  return null;
}
