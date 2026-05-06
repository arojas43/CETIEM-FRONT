"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

export type UserRole = "company" | "assessor" | "admin";

interface RoleContextType {
  role: UserRole;
}

const RoleContext = createContext<RoleContextType>({ role: "company" });

export function RoleProvider({
  children,
  defaultRole,
}: {
  children: ReactNode;
  defaultRole?: UserRole;
}) {
  // Role is derived exclusively from the server session — never from localStorage.
  // This prevents stale/spoofed roles when switching accounts or after logout.
  const [role, setRoleState] = useState<UserRole>(defaultRole ?? "company");

  useEffect(() => {
    if (defaultRole) setRoleState(defaultRole);
  }, [defaultRole]);

  return (
    <RoleContext.Provider value={{ role }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  return useContext(RoleContext);
}
