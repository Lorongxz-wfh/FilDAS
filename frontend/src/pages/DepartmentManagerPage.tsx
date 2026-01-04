// src/pages/DepartmentManagerPage.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import Modal from "../components/Modal";
import { notify } from "../lib/notify";

const getDepartmentLogoUrl = (dept: Department) =>
  dept.logo_path
    ? `http://localhost:8000/storage/fildas_assets/${dept.logo_path}`
    : null;

type Department = {
  id: number;
  name: string;
  code: string | null;
  description: string | null;
  is_active: boolean;
  is_qa?: boolean; // QA flag
  theme_color?: string | null;
  logo_path?: string | null;
  created_at: string;
  updated_at: string;
  owner?: { id: number; name: string } | null;
  type?: { id: number; name: string } | null;
};

type DepartmentType = { id: number; name: string };
type SimpleUser = { id: number; name: string };

type LayoutContext = {
  user: {
    id: number;
    name: string;
    email: string;
    department_id: number | null;
    role?: { id: number; name: string } | null;
  };
  isAdmin: boolean;
  isSuperAdmin: boolean;
};

// NOTE: we will wire this into routing after the page compiles.

export default function DepartmentManagerPage() {
  const navigate = useNavigate();

  const [departments, setDepartments] = useState<Department[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [departmentTypes, setDepartmentTypes] = useState<DepartmentType[]>([]);
  const [users, setUsers] = useState<SimpleUser[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [activeDept, setActiveDept] = useState<Department | null>(null);

  const [formName, setFormName] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formTypeId, setFormTypeId] = useState<number | null>(null);
  const [formOwnerId, setFormOwnerId] = useState<number | null>(null);
  const [formThemeColor, setFormThemeColor] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);
  const [formIsQa, setFormIsQa] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);

  const [viewMode, setViewMode] = useState<"table" | "grid">("table");

  // ---------- data loading ----------
  const loadDepartments = async () => {
    setError(null);
    try {
      const res = await api.get("/departments");
      const data = (res.data.data ?? res.data) as Department[];
      setDepartments(data);
    } catch (e) {
      console.error(e);
      setError("Failed to load departments.");
    }
  };

  const loadLookups = async () => {
    try {
      const [typesRes, usersRes] = await Promise.all([
        api.get("/department-types"),
        api.get("/users"),
      ]);
      setDepartmentTypes(
        (typesRes.data.data ?? typesRes.data) as DepartmentType[]
      );
      setUsers(
        ((usersRes.data.data ?? usersRes.data) as any[]).map((u) => ({
          id: u.id,
          name: u.name,
        }))
      );
    } catch (e) {
      console.error("Failed to load lookups", e);
    }
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([loadDepartments(), loadLookups()]).finally(() =>
      setLoading(false)
    );
  }, []);

  // ---------- helpers ----------
  const resetForm = () => {
    setFormName("");
    setFormCode("");
    setFormDescription("");
    setFormTypeId(null);
    setFormOwnerId(null);
    setFormThemeColor("");
    setFormIsActive(true);
    setFormIsQa(false);
    setLogoFile(null);
    setActiveDept(null);
  };

  const openCreate = () => {
    resetForm();
    setCreateOpen(true);
  };

  const openEdit = (dept: Department) => {
    setActiveDept(dept);
    setFormName(dept.name || "");
    setFormCode(dept.code || "");
    setFormDescription(dept.description || "");
    setFormTypeId((dept as any).department_type_id ?? dept.type?.id ?? null);
    setFormOwnerId((dept as any).owner_id ?? dept.owner?.id ?? null);
    setFormThemeColor(dept.theme_color || "");
    setFormIsActive(dept.is_active ?? true);
    setFormIsQa(!!(dept as any).is_qa);
    setLogoFile(null);
    setEditOpen(true);
  };

  const openInDocumentManager = (dept: Department) => {
    navigate("/files", {
      state: { departmentId: dept.id },
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Department form submit", {
      activeDept,
      formName,
      formCode,
      formDescription,
    });
    if (!formName.trim()) return;

    setSaving(true);
    try {
      if (activeDept) {
        // update
        const res = await api.patch(`/departments/${activeDept.id}`, {
          name: formName.trim(),
          code: formCode.trim() || null,
          description: formDescription.trim() || null,
          department_type_id: formTypeId,
          owner_id: formOwnerId,
          theme_color: formThemeColor.trim() || null,
          is_active: formIsActive,
          is_qa: formIsQa,
        });

        let updated: Department = res.data.department ?? res.data;

        if (logoFile) {
          const logoForm = new FormData();
          logoForm.append("logo", logoFile);
          const logoRes = await api.post(
            `/departments/${updated.id}/logo`,
            logoForm,
            { headers: { "Content-Type": "multipart/form-data" } }
          );
          updated = logoRes.data.department ?? logoRes.data;
        }

        setDepartments((prev) =>
          prev.map((d) => (d.id === updated.id ? updated : d))
        );
        notify("Department updated.", "success");
      } else {
        // create
        const res = await api.post("/departments", {
          name: formName.trim(),
          code: formCode.trim() || null,
          description: formDescription.trim() || null,
          department_type_id: formTypeId,
          owner_id: formOwnerId,
          theme_color: formThemeColor.trim() || null,
          is_active: formIsActive,
          is_qa: formIsQa,
        });

        let created: Department = res.data.department ?? res.data;

        // If logo selected, upload it
        if (logoFile) {
          const logoForm = new FormData();
          logoForm.append("logo", logoFile);
          const logoRes = await api.post(
            `/departments/${created.id}/logo`,
            logoForm,
            { headers: { "Content-Type": "multipart/form-data" } }
          );
          created = logoRes.data.department ?? logoRes.data;
        }

        setDepartments((prev) => [...prev, created]);

        notify("Department created.", "success");

        // TODO: in a later step we will ensure root folder creation here.
      }
      setCreateOpen(false);
      setEditOpen(false);
      resetForm();
    } catch (err) {
      console.error(err);
      notify("Failed to save department.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (dept: Department) => {
    if (!window.confirm(`Delete department "${dept.name}"?`)) return;
    try {
      await api.delete(`/departments/${dept.id}`);
      setDepartments((prev) => prev.filter((d) => d.id !== dept.id));
      notify("Department deleted.", "success");
    } catch (err) {
      console.error(err);
      notify("Failed to delete department.", "error");
    }
  };

  const handleToggleActive = async (dept: Department) => {
    try {
      const res = await api.patch(`/departments/${dept.id}`, {
        is_active: !dept.is_active,
      });
      const updated: Department = res.data.department ?? res.data;
      setDepartments((prev) =>
        prev.map((d) => (d.id === updated.id ? updated : d))
      );
      notify(
        updated.is_active ? "Department activated." : "Department deactivated.",
        "success"
      );
    } catch (err) {
      console.error(err);
      notify("Failed to update status.", "error");
    }
  };

  // ---------- UI ----------
  return (
    <div>
      <h1 className="mb-2 text-2xl font-semibold text-white">
        Department manager
      </h1>

      <div className="mb-3 flex items-center justify-between text-sm">
        <div className="inline-flex rounded-md border border-slate-700 bg-slate-900">
          <button
            type="button"
            className={`px-2 py-1 text-[11px] ${
              viewMode === "table"
                ? "bg-slate-800 text-sky-300"
                : "text-slate-400"
            }`}
            onClick={() => setViewMode("table")}
          >
            List
          </button>
          <button
            type="button"
            className={`px-2 py-1 text-[11px] ${
              viewMode === "grid"
                ? "bg-slate-800 text-sky-300"
                : "text-slate-400"
            }`}
            onClick={() => setViewMode("grid")}
          >
            Grid
          </button>
        </div>

        <Button size="sm" variant="primary" onClick={openCreate}>
          New department
        </Button>
      </div>

      <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-sm">
        {error && <p className="mb-2 text-xs text-red-400">{error}</p>}

        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
          </div>
        ) : departments.length === 0 ? (
          <p className="text-xs text-slate-500">No departments defined.</p>
        ) : viewMode === "table" ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="border-b border-slate-800 text-[11px] uppercase text-slate-400">
                <tr>
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">Code</th>
                  <th className="py-2 pr-3">Description</th>
                  <th className="py-2 pr-3">Owner</th>
                  <th className="py-2 pr-3">Type</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Created</th>
                  <th className="py-2 pr-3">Updated</th>
                  <th className="py-2 pr-3 text-right">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-800">
                {departments.map((dept) => (
                  <tr key={dept.id}>
                    <td className="py-2 pr-3 text-slate-100">
                      <div className="flex items-center gap-2">
                        {getDepartmentLogoUrl(dept) ? (
                          <img
                            src={getDepartmentLogoUrl(dept)!}
                            alt={dept.name}
                            className="h-6 w-6 rounded-full object-cover border border-slate-700"
                          />
                        ) : (
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 text-[10px] uppercase text-slate-300">
                            {dept.name.charAt(0)}
                          </div>
                        )}
                        <span>{dept.name}</span>
                      </div>
                    </td>
                    <td className="py-2 pr-3 text-slate-300">
                      {dept.code || "—"}
                    </td>
                    <td className="py-2 pr-3 text-slate-300">
                      {dept.description || "—"}
                    </td>
                    <td className="py-2 pr-3 text-slate-300">
                      {dept.owner?.name || "—"}
                    </td>
                    <td className="py-2 pr-3 text-slate-300">
                      {dept.type?.name || "—"}
                    </td>
                    <td className="py-2 pr-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          dept.is_active
                            ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/40"
                            : "bg-slate-700/40 text-slate-300 border border-slate-600/60"
                        }`}
                      >
                        {dept.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-slate-400">
                      {new Date(dept.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-2 pr-3 text-slate-400">
                      {new Date(dept.updated_at).toLocaleDateString()}
                    </td>
                    <td className="py-2 pr-3 text-right">
                      <Button
                        size="xs"
                        variant="primary"
                        className="mr-2"
                        onClick={() => openInDocumentManager(dept)}
                      >
                        Open files
                      </Button>
                      <Button
                        size="xs"
                        variant="ghost"
                        className="mr-2"
                        onClick={() => handleToggleActive(dept)}
                      >
                        {dept.is_active ? "Deactivate" : "Activate"}
                      </Button>
                      <Button
                        size="xs"
                        variant="secondary"
                        className="mr-2"
                        onClick={() => openEdit(dept)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => handleDelete(dept)}
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {departments.map((dept) => (
              <div
                key={dept.id}
                className="flex flex-col rounded-lg border border-slate-800 bg-slate-900/70 p-3 text-xs"
              >
                <div className="mb-3 flex items-start gap-3">
                  {getDepartmentLogoUrl(dept) ? (
                    <img
                      src={getDepartmentLogoUrl(dept)!}
                      alt={dept.name}
                      className="h-12 w-12 rounded-full object-cover border border-slate-700"
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-800 text-[13px] uppercase text-slate-300">
                      {dept.name.charAt(0)}
                    </div>
                  )}

                  <div className="flex flex-1 flex-col">
                    <div className="text-sm font-semibold text-slate-100">
                      {dept.name}
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 font-medium ${
                          dept.is_active
                            ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/40"
                            : "bg-slate-700/40 text-slate-300 border border-slate-600/60"
                        }`}
                      >
                        {dept.is_active ? "Active" : "Inactive"}
                      </span>
                      <span className="text-slate-400">
                        {dept.type?.name || "No type"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mb-2 line-clamp-2 text-[11px] text-slate-300">
                  {dept.description || "No description."}
                </div>

                <div className="mt-auto flex items-center justify-between pt-1 text-[11px] text-slate-400">
                  <span>{dept.code || "No code"}</span>
                  <div className="flex gap-1">
                    <Button
                      size="xs"
                      variant="primary"
                      onClick={() => openInDocumentManager(dept)}
                    >
                      Open files
                    </Button>
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() => handleToggleActive(dept)}
                    >
                      {dept.is_active ? "Deactivate" : "Activate"}
                    </Button>
                    <Button
                      size="xs"
                      variant="secondary"
                      onClick={() => openEdit(dept)}
                    >
                      Edit
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Create / Edit modal */}
      <Modal
        open={createOpen || editOpen}
        title={activeDept ? "Edit department" : "New department"}
        onClose={() => {
          setCreateOpen(false);
          setEditOpen(false);
          resetForm();
        }}
      >
        <form className="space-y-3 text-sm" onSubmit={handleSubmit}>
          {/* Name + code + description */}
          <div>
            <label className="mb-1 block text-xs text-slate-400">Name *</label>
            <input
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-slate-400">
              Code (optional)
            </label>
            <input
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
              value={formCode}
              onChange={(e) => setFormCode(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-slate-400">
              Description (optional)
            </label>
            <textarea
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
              rows={3}
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
            />
          </div>

          {/* Type + owner */}
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-slate-400">
                Department type
              </label>
              <select
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                value={formTypeId ?? ""}
                onChange={(e) =>
                  setFormTypeId(e.target.value ? Number(e.target.value) : null)
                }
              >
                <option value="">None</option>
                {departmentTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs text-slate-400">
                Owner / head
              </label>
              <select
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                value={formOwnerId ?? ""}
                onChange={(e) =>
                  setFormOwnerId(e.target.value ? Number(e.target.value) : null)
                }
              >
                <option value="">None</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Theme color + logo */}
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-slate-400">
                Theme color (hex, optional)
              </label>
              <input
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                placeholder="#0ea5e9"
                value={formThemeColor}
                onChange={(e) => setFormThemeColor(e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-slate-400">
                Logo (optional)
              </label>
              <input
                type="file"
                accept="image/*"
                className="block w-full text-xs text-slate-300"
                onChange={(e) =>
                  setLogoFile(
                    e.target.files && e.target.files[0]
                      ? e.target.files[0]
                      : null
                  )
                }
              />
            </div>
          </div>

          {/* QA department only (no Active checkbox here) */}
          <div className="flex items-center gap-2 pt-1">
            <input
              id="dept-qa"
              type="checkbox"
              className="h-3 w-3 rounded border-slate-600 bg-slate-900 text-sky-500"
              checked={formIsQa}
              onChange={(e) => setFormIsQa(e.target.checked)}
            />
            <label
              htmlFor="dept-qa"
              className="text-xs text-slate-300 select-none"
            >
              QA department (can review all docs)
            </label>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              size="xs"
              variant="secondary"
              onClick={() => {
                setCreateOpen(false);
                setEditOpen(false);
                resetForm();
              }}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" size="xs" disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
