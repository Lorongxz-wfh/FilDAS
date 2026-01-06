// src/pages/UserManagerPage.tsx
import { useEffect, useState } from "react";
import Modal from "../components/Modal";
import { Loader } from "../components/ui/Loader";
import { api } from "../lib/api";
import { notify } from "../lib/notify";

type UserFormMode = "create" | "edit";

type User = {
  id: number;
  name: string;
  email: string;
  role: string | null;
  status: "active" | "inactive";
  department_id: number | null;
  department_name?: string | null;
};

type UserFormState = {
  id?: number;
  name: string;
  email: string;
  role: "Super Admin" | "Admin" | "Staff";
  status: "active" | "inactive";
  department_id: number | null;
  password: string;
};

type UserDetails = User & {
  owned_departments: number;
  owned_folders: number;
  owned_documents: number;
  outgoing_shares: number;
  incoming_shares: number;
  created_at: string;
  updated_at: string;
};

type Department = {
  id: number;
  name: string;
};

const EMPTY_FORM: UserFormState = {
  name: "",
  email: "",
  role: "Staff",
  status: "active",
  department_id: null,
  password: "",
};

const ROLE_NAME_TO_ID: Record<UserFormState["role"], number> = {
  "Super Admin": 1,
  Admin: 2,
  Staff: 3,
};

export default function UserManagerPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
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
  const [roleFilter, setRoleFilter] = useState<
    "all" | "Super Admin" | "Admin" | "Staff"
  >("all");

  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [userDetails, setUserDetails] = useState<UserDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const [departmentFilter, setDepartmentFilter] = useState<number | "all">(
    "all"
  );
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

  const loadUserDetails = async (userId: number) => {
    setDetailsLoading(true);
    try {
      const res = await api.get<UserDetails>(`/users/${userId}`);
      setUserDetails(res.data);
    } catch (e) {
      console.error(e);
      notify("Failed to load user details.", "error");
      setUserDetails(null);
    } finally {
      setDetailsLoading(false);
    }
  };

  const loadDepartments = async () => {
    try {
      const res = await api.get<{ data: Department[] }>("/departments");
      setDepartments(res.data.data ?? []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadUsers();
    loadDepartments();
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
      status: user.status,
      department_id: user.department_id ?? null,
      password: "",
    });
    setErrorMsg(null);
    setUserModalOpen(true);
  };

  const openDetails = (user: User) => {
    setSelectedUserId(user.id);
    setDetailsOpen(true);
    loadUserDetails(user.id);
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

      const rawStatus = form.status === "inactive" ? "disabled" : "active";

      if (userModalMode === "create") {
        await api.post("/users", {
          name: form.name,
          email: form.email,
          role_id,
          department_id: form.department_id,
          status: rawStatus,
          password: form.password,
        });
        notify(`User "${form.name}" created.`, "success");
      } else {
        await api.put(`/users/${form.id}`, {
          name: form.name,
          email: form.email,
          role_id,
          department_id: form.department_id,
          status: rawStatus,
          ...(form.password ? { password: form.password } : {}),
        });
        notify(`User "${form.name}" updated.`, "success");
      }

      await loadUsers();
      setUserModalOpen(false);
      setForm(EMPTY_FORM);
    } catch (err) {
      console.error(err);
      const msg =
        (err as any)?.response?.data?.message ??
        "Could not save user. Please check the form and try again.";
      setErrorMsg(msg);
      notify(msg, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const updateUserStatus = async (
    user: User,
    nextStatus: "active" | "inactive"
  ) => {
    try {
      const rawStatus = nextStatus === "inactive" ? "disabled" : "active";
      await api.put(`/users/${user.id}`, {
        status: rawStatus,
      });
      await loadUsers();
      notify(
        `User "${user.name}" is now ${
          nextStatus === "active" ? "active" : "inactive"
        }.`,
        "success"
      );
    } catch (err) {
      console.error(err);
      notify("Failed to update user status.", "error");
    }
  };

  const deleteUser = async (user: User) => {
    if (
      !window.confirm(
        `Delete user "${user.name}"? This can be undone only by database restore.`
      )
    ) {
      return;
    }

    try {
      await api.delete(`/users/${user.id}`);
      await loadUsers();
      notify(`User "${user.name}" has been deleted.`, "success");
    } catch (err) {
      console.error(err);
      notify("Failed to delete user.", "error");
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

      const matchesRole =
        roleFilter === "all" ? true : (u.role ?? "") === roleFilter;

      const matchesDepartment =
        departmentFilter === "all"
          ? true
          : u.department_id === departmentFilter;

      return matchesSearch && matchesStatus && matchesRole && matchesDepartment;
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
          </div>

          <div className="flex flex-wrap gap-2">
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
              <option value="all">All statuses</option>
            </select>
            <select
              className="rounded-md border border-slate-700 bg-slate-900/60 px-2 py-2 text-sm text-white focus:outline-none"
              value={roleFilter}
              onChange={(e) =>
                setRoleFilter(
                  e.target.value as "all" | "Super Admin" | "Admin" | "Staff"
                )
              }
            >
              <option value="all">All roles</option>
              <option value="Super Admin">Super Admin</option>
              <option value="Admin">Admin</option>
              <option value="Staff">Staff</option>
            </select>
            <select
              className="rounded-md border border-slate-700 bg-slate-900/60 px-2 py-2 text-sm text-white focus:outline-none"
              value={
                departmentFilter === "all" ? "all" : String(departmentFilter)
              }
              onChange={(e) =>
                setDepartmentFilter(
                  e.target.value === "all" ? "all" : Number(e.target.value)
                )
              }
            >
              <option value="all">All departments</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div
          className={`h-[calc(100vh-180px)] ${
            detailsOpen ? "flex gap-3" : "flex"
          }`}
        >
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
                      <td colSpan={6} className="py-4 text-center">
                        <Loader label="Loading users..." size="sm" />
                      </td>
                    </tr>
                  )}

                  {!loading &&
                    filtered.map((user) => (
                      <tr key={user.id} className="hover:bg-slate-800/60">
                        <td className="py-2 pr-4 text-white">{user.name}</td>
                        <td className="py-2 pr-4 text-slate-400">
                          {user.email}
                        </td>
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
                        <td className="py-2 pr-4 space-x-2 text-xs">
                          <button
                            className="text-sky-400 hover:underline"
                            onClick={() => openDetails(user)}
                          >
                            Details
                          </button>
                          <button
                            className="text-sky-400 hover:underline"
                            onClick={() => openEditWithUser(user)}
                          >
                            Edit
                          </button>
                          {user.status === "active" ? (
                            <button
                              className="text-amber-400 hover:underline"
                              onClick={() => updateUserStatus(user, "inactive")}
                            >
                              Disable
                            </button>
                          ) : (
                            <button
                              className="text-emerald-400 hover:underline"
                              onClick={() => updateUserStatus(user, "active")}
                            >
                              Enable
                            </button>
                          )}
                          <button
                            className="text-rose-400 hover:underline"
                            onClick={() => deleteUser(user)}
                          >
                            Delete
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

          {/* Details side panel */}
          {detailsOpen && (
            <aside className="w-80 shrink-0 rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-sm">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase text-slate-400">
                  User details
                </p>
                <button
                  className="text-xs text-slate-400 hover:text-slate-200"
                  onClick={() => setDetailsOpen(false)}
                >
                  Close
                </button>
              </div>

              {!detailsOpen && (
                <p className="text-xs text-slate-500">
                  Select “Details” on a user to view more information.
                </p>
              )}

              {detailsOpen && detailsLoading && (
                <div className="py-4 text-center">
                  <Loader label="Loading details..." size="sm" />
                </div>
              )}

              {detailsOpen && !detailsLoading && userDetails && (
                <div className="space-y-3 text-xs">
                  <div>
                    <p className="text-slate-500">Name</p>
                    <p className="text-white">{userDetails.name}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Email</p>
                    <p className="text-slate-200">{userDetails.email}</p>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div>
                      <p className="text-slate-500">Role</p>
                      <p className="text-slate-200">
                        {userDetails.role ?? "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">Department</p>
                      <p className="text-slate-200">
                        {userDetails.department_name ?? "—"}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-slate-500">Owned documents</p>
                      <p className="text-slate-200">
                        {userDetails.owned_documents}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">Owned folders</p>
                      <p className="text-slate-200">
                        {userDetails.owned_folders}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">Owned departments</p>
                      <p className="text-slate-200">
                        {userDetails.owned_departments}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">Outgoing shares</p>
                      <p className="text-slate-200">
                        {userDetails.outgoing_shares}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">Incoming shares</p>
                      <p className="text-slate-200">
                        {userDetails.incoming_shares}
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-slate-500">Created at</p>
                    <p className="text-slate-200">
                      {new Date(userDetails.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">Updated at</p>
                    <p className="text-slate-200">
                      {new Date(userDetails.updated_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              )}
            </aside>
          )}
        </div>
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
              Department
            </label>
            <select
              className="w-full rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-white focus:outline-none"
              value={form.department_id ?? ""}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  department_id: e.target.value ? Number(e.target.value) : null,
                }))
              }
            >
              <option value="">— No department —</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
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
