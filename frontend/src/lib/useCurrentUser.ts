import { useEffect, useState } from "react";
import { api } from "./api";

export type CurrentUser = {
  id: number;
  name: string;
  email: string;
  department_id: number | null;
  role?: { id: number; name: string } | null;
  department?: { id: number; name: string; is_qa?: boolean } | null;
};

export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get("/user");
        setUser(res.data);
      } catch (e) {
        console.error("Failed to load current user", e);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return { user, loading };
}
