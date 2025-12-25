// src/pages/UserManagerPage.tsx
import { useEffect, useState } from "react";
import Modal from "../components/Modal";
import { api } from "../lib/api";

type UserFormMode = "create" | "edit";

type User = {
  id: number;
  name: string;
  email: string;
  // e.g. "Super Admin" / "Admin" / "Staff"
  role: string | null;
  // "active" | "inactive" coming from API (effective_status)
  status: "active" | "inactive";
  // optional, if you include it from backend
  department_name?: string | null;
};

type UserFormState = {
  id?: number;
  name: string;
  email: string;
  role: "Super Admin" | "Admin" | "Staff";
  // UI-level flag; backend still stores raw status column you decide
  status: "active" | "inactive";
  password: string;
};

const EMPTY_FORM: UserFormState = {
  name: "",
  email: "",
  role: "Staff",
  status: "active",
  password: "",
};

const ROLE_NAME_TO_ID: Record<UserFormState["role"], number> = {
  "Super Admin": 1,
  Admin: 2,
  Staff: 3,
};

export default function UserManagerPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const [userModalOpen, setUserModalOpen] = useState(false);
  const [userModalMode, setUserModalMode] = useState<UserFormMode>("create");
  const [form, setForm] = useState<UserFormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // new: status filter + sort mode
  const [statusFilter, setStatusFilter] = useState<
    "active" | "inactive" | "all"
  >("active");
  const [sortMode, setSortMode] = useState<
    "dept-role-name" | "role-name" | "name"
  >("dept-role-name");

  // load users from API
  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get<User[]>("/users");
      setUsers(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const openCreate = () => {
    setUserModalMode("create");
    setForm(EMPTY_FORM);
    setErrorMsg(null);
    setUserModalOpen(true);
  };

  const openEditWithUser = (user: User) => {
    setUserModalMode("edit");

    const roleName =
      (user.role as UserFormState["role"]) ||
      ("Staff" as UserFormState["role"]);

    setForm({
      id: user.id,
      name: user.name,
      email: user.email,
      role: roleName,
      // map effective status back to UI status toggle
      status: user.status,
      password: "",
    });
    setErrorMsg(null);
    setUserModalOpen(true);
  };

  const handleChange =
    (field: keyof UserFormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
    };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);

    try {
      const role_id = ROLE_NAME_TO_ID[form.role];

      // backend can decide how to map UI "inactive" to its raw status column
      const rawStatus = form.status === "inactive" ? "disabled" : "active";

      if (userModalMode === "create") {
        await api.post("/users", {
          name: form.name,
          email: form.email,
          role_id,
          status: rawStatus,
          password: form.password,
        });
      } else {
        await api.put(`/users/${form.id}`, {
          name: form.name,
          email: form.email,
          role_id,
          status: rawStatus,
          ...(form.password ? { password: form.password } : {}),
        });
      }

      await loadUsers();
      setUserModalOpen(false);
      setForm(EMPTY_FORM);
    } catch (err) {
      console.error(err);
      setErrorMsg("Could not save user. Please check the form and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = users
    .filter((u) => {
      const q = search.toLowerCase();
      const matchesSearch =
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.role ?? "").toLowerCase().includes(q);

      const matchesStatus =
        statusFilter === "all" ? true : u.status === statusFilter;

      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      if (sortMode === "name") {
        return a.name.localeCompare(b.name);
      }

      if (sortMode === "dept-role-name") {
        const deptA = (a.department_name ?? "").toLowerCase();
        const deptB = (b.department_name ?? "").toLowerCase();
        if (deptA !== deptB) return deptA.localeCompare(deptB);

        const roleA = (a.role ?? "").toLowerCase();
        const roleB = (b.role ?? "").toLowerCase();
        if (roleA !== roleB) return roleA.localeCompare(roleB);

        return a.name.localeCompare(b.name);
      }

      if (sortMode === "role-name") {
        const roleA = (a.role ?? "").toLowerCase();
        const roleB = (b.role ?? "").toLowerCase();
        if (roleA !== roleB) return roleA.localeCompare(roleB);
        return a.name.localeCompare(b.name);
      }

      return 0;
    });

  return (
    <>
      <div className="flex h-full flex-col gap-3">
        {/* Header */}
        <header>
          <h1 className="mb-1 text-2xl font-semibold text-white">
            User manager
          </h1>
        </header>

        {/* Toolbar */}
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            <button
              className="rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-500"
              onClick={openCreate}
            >
              + New user
            </button>
            <button className="rounded-md border border-slate-700 px-3 py-2 text-sm text-white hover:bg-slate-800">
              Bulk actions
            </button>
          </div>

          <div className="flex gap-2">
            <input
              className="rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              placeholder="Search users…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              className="rounded-md border border-slate-700 bg-slate-900/60 px-2 py-2 text-sm text-white focus:outline-none"
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as "active" | "inactive" | "all")
              }
            >
              <option value="active">Active only</option>
              <option value="inactive">Inactive only</option>
              <option value="all">All users</option>
            </select>
            <select
              className="rounded-md border border-slate-700 bg-slate-900/60 px-2 py-2 text-sm text-white focus:outline-none"
              value={sortMode}
              onChange={(e) =>
                setSortMode(
                  e.target.value as "dept-role-name" | "role-name" | "name"
                )
              }
            >
              <option value="dept-role-name">Dept → Role → Name</option>
              <option value="role-name">Role → Name</option>
              <option value="name">Name (A–Z)</option>
            </select>
          </div>
        </div>

        {/* Users table */}
        <section className="flex-1 overflow-hidden rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-sm">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase text-slate-400">
              Users
            </p>
            <p className="text-xs text-slate-500">
              {loading
                ? "Loading…"
                : `Showing ${filtered.length} of ${users.length} user(s)`}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-800 text-xs uppercase text-slate-400">
                <tr>
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Email</th>
                  <th className="py-2 pr-4">Department</th>
                  <th className="py-2 pr-4">Role</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {loading && (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-4 text-center text-sm text-slate-500"
                    >
                      Loading users…
                    </td>
                  </tr>
                )}

                {!loading &&
                  filtered.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-800/60">
                      <td className="py-2 pr-4 text-white">{user.name}</td>
                      <td className="py-2 pr-4 text-slate-400">{user.email}</td>
                      <td className="py-2 pr-4 text-slate-400">
                        {user.department_name ?? "—"}
                      </td>
                      <td className="py-2 pr-4">
                        <span className="rounded-full bg-slate-500/20 px-2 py-0.5 text-xs text-slate-200">
                          {user.role ?? "—"}
                        </span>
                      </td>
                      <td
                        className={
                          "py-2 pr-4 text-xs " +
                          (user.status === "active"
                            ? "text-emerald-400"
                            : "text-slate-400")
                        }
                      >
                        {user.status === "active" ? "Active" : "Inactive"}
                      </td>
                      <td className="py-2 pr-4 space-x-2">
                        <button
                          className="text-xs text-sky-400 hover:underline"
                          onClick={() => openEditWithUser(user)}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}

                {!loading && filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-4 text-center text-sm text-slate-500"
                    >
                      {users.length === 0
                        ? "No users yet."
                        : "No users match your filters."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* New/Edit user modal */}
      <Modal
        open={userModalOpen}
        title={userModalMode === "create" ? "Create new user" : "Edit user"}
        onClose={() => setUserModalOpen(false)}
      >
        <form className="space-y-3 text-sm" onSubmit={handleSubmit}>
          {errorMsg && (
            <p className="rounded border border-rose-900 bg-rose-950/40 px-2 py-1 text-xs text-rose-400">
              {errorMsg}
            </p>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-slate-400">
                Full name
              </label>
              <input
                className="w-full rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                value={form.name}
                onChange={handleChange("name")}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Email</label>
              <input
                type="email"
                className="w-full rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                value={form.email}
                onChange={handleChange("email")}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-slate-400">Role</label>
              <select
                className="w-full rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-white focus:outline-none"
                value={form.role}
                onChange={handleChange("role")}
              >
                <option>Super Admin</option>
                <option>Admin</option>
                <option>Staff</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">
                Status
              </label>
              <select
                className="w-full rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-white focus:outline-none"
                value={form.status}
                onChange={handleChange("status")}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs text-slate-400">
              Password (leave blank to keep current)
            </label>
            <input
              type="password"
              className="w-full rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
              value={form.password}
              onChange={handleChange("password")}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="rounded-md border border-slate-700 px-3 py-2 text-xs text-white hover:bg-slate-800"
              onClick={() => setUserModalOpen(false)}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-md bg-sky-600 px-3 py-2 text-xs font-medium text-white hover:bg-sky-500 disabled:opacity-60"
              disabled={submitting}
            >
              {userModalMode === "create" ? "Create user" : "Save changes"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
