"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

export type UserRole = "company" | "assessor" | "admin";

interface RoleContextType {
  role: UserRole;
  setRole: (role: UserRole) => void;
}

const RoleContext = createContext<RoleContextType>({
  role: "company",
  setRole: () => {},
});

export function RoleProvider({
  children,
  defaultRole,
}: {
  children: ReactNode;
  defaultRole?: UserRole;
}) {
  const [role, setRoleState] = useState<UserRole>(defaultRole ?? "company");

  useEffect(() => {
    if (defaultRole) {
      // Session role takes precedence — always sync
      setRoleState(defaultRole);
      localStorage.setItem("cetiem_role", defaultRole);
      return;
    }
    const saved = localStorage.getItem("cetiem_role") as UserRole | null;
    if (saved && ["company", "assessor", "admin"].includes(saved)) {
      setRoleState(saved);
    }
  }, [defaultRole]);

  const setRole = (r: UserRole) => {
    setRoleState(r);
    localStorage.setItem("cetiem_role", r);
  };

  return (
    <RoleContext.Provider value={{ role, setRole }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  return useContext(RoleContext);
}
