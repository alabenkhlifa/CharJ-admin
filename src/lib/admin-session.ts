import { createContext, useContext } from "react";
import { supabase } from "./supabase";

// The signed-in admin, provided by <AuthGate> to everything inside it.
export type AdminSession = {
  email: string;
  signOut: () => Promise<void>;
};

export const AdminSessionContext = createContext<AdminSession | null>(null);

export const useAdminSession = () => useContext(AdminSessionContext);

export const NOT_ADMIN_NOTICE = "This account is not an admin.";
export const SESSION_EXPIRED_NOTICE = "Your session expired. Sign in again.";

// Forced sign-outs (an admin endpoint said 401/403) carry a reason the
// sign-in card shows once the session is gone.
type NoticeListener = (notice: string) => void;
const listeners = new Set<NoticeListener>();

export const onAuthNotice = (listener: NoticeListener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const forceSignOut = async (notice: string) => {
  listeners.forEach((listener) => listener(notice));
  // Local only: the server already refused this token, no point asking it to
  // revoke anything.
  await supabase.auth.signOut({ scope: "local" });
};
