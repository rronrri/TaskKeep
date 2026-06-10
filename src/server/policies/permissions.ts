import type { SessionUser, UserRole } from "@/types";

export function hasRole(user: SessionUser, roles: UserRole[]) {
  return roles.includes(user.role);
}

export function canAccessCompany(user: SessionUser, companyId: string) {
  return user.role === "admin" || user.companyId === companyId;
}

export function roleHome(role: UserRole) {
  return `/${role}/dashboard`;
}
