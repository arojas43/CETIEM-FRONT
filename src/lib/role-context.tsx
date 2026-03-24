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

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<UserRole>("company");

  useEffect(() => {
    const saved = localStorage.getItem("cetiem_role") as UserRole | null;
    if (saved && ["company", "assessor", "admin"].includes(saved)) {
      setRoleState(saved);
    }
  }, []);

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
