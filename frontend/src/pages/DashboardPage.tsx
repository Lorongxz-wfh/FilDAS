// src/pages/DashboardPage.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Modal from "../components/Modal";

export default function DashboardPage() {
  const [newRecordOpen, setNewRecordOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <>
      <h1 className="text-2xl font-semibold mb-2 text-white">Dashboard</h1>
      {/* <p className="text-slate-300 text-sm mb-4">
        Latest overview of your digital archive.
      </p> */}

      {/* Stats row */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs text-slate-400">Total records</p>
          <p className="mt-2 text-2xl font-semibold text-white">1,240</p>
          <p className="mt-1 text-xs text-emerald-400">+8% this month</p>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs text-slate-400">Digital items</p>
          <p className="mt-2 text-2xl font-semibold text-white">860</p>
          <p className="mt-1 text-xs text-sky-400">62% of total</p>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs text-slate-400">Collections</p>
          <p className="mt-2 text-2xl font-semibold text-white">32</p>
          <p className="mt-1 text-xs text-amber-400">3 new this week</p>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs text-slate-400">Active users</p>
          <p className="mt-2 text-2xl font-semibold text-white">14</p>
          <p className="mt-1 text-xs text-slate-400">Staff &amp; librarians</p>
        </div>
      </div>

      {/* Recent items + Quick actions */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent items */}
        <section className="lg:col-span-2 rounded-lg border border-slate-800 bg-slate-900/60 p-4">
          <h2 className="text-sm font-semibold text-slate-200">Recent items</h2>
          <p className="mt-1 text-xs text-slate-400">
            Latest records added to the archive.
          </p>

          <ul className="mt-4 space-y-3 text-sm">
            <li className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-200">Yearbook 2015</p>
                <p className="text-xs text-slate-400">Scanned · Humanities</p>
              </div>
              <span className="text-xs text-slate-400">5 min ago</span>
            </li>
            <li className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-200">
                  Research Journal Vol. 3
                </p>
                <p className="text-xs text-slate-400">PDF · Graduate Studies</p>
              </div>
              <span className="text-xs text-slate-400">32 min ago</span>
            </li>
            <li className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-200">Campus Newsletter</p>
                <p className="text-xs text-slate-400">
                  Image · Student Affairs
                </p>
              </div>
              <span className="text-xs text-slate-400">2 hrs ago</span>
            </li>
          </ul>
        </section>

        {/* Quick actions */}
        <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
          <h2 className="text-sm font-semibold text-slate-200">
            Quick actions
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Common tasks for archive staff.
          </p>

          <div className="mt-4 space-y-2 text-sm">
            <button
              className="w-full rounded-md bg-sky-600 px-3 py-2 text-left font-medium text-white hover:bg-sky-500"
              onClick={() => setNewRecordOpen(true)}
            >
              + New record
            </button>
            <button className="w-full rounded-md border border-slate-700 px-3 py-2 text-left text-slate-200 hover:bg-slate-800">
              Upload files
            </button>
            <button className="w-full rounded-md border border-slate-700 px-3 py-2 text-left text-slate-200 hover:bg-slate-800">
              Manage collections
            </button>
          </div>
        </section>
      </div>

      {/* Main modules row */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* File Manager */}
        <section
          className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 hover:border-sky-500 hover:bg-slate-900/80 cursor-pointer transition"
          onClick={() => navigate("/files")}
        >
          <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-sky-600 text-xs text-white">
              FM
            </span>
            Document Manager
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            CRUD folders and files, previews, audit logs, bulk upload and
            download.
          </p>
        </section>

        {/* User Manager */}
        <section
          className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 hover:border-sky-500 hover:bg-slate-900/80 cursor-pointer transition"
          onClick={() => navigate("/users")}
        >
          <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-emerald-600 text-xs text-white">
              UM
            </span>
            User Manager
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Manage users, roles, and permissions for archive access.
          </p>
        </section>

        {/* Reports & Logs */}
        <section
          className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 hover:border-sky-500 hover:bg-slate-900/80 cursor-pointer transition"
          onClick={() => navigate("/reports")}
        >
          <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-amber-600 text-xs text-white">
              R
            </span>
            Reports &amp; Logs
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            View activity logs, usage reports, and approval history.
          </p>
        </section>
      </div>

      {/* New record modal */}
      <Modal
        open={newRecordOpen}
        title="Create new record"
        onClose={() => setNewRecordOpen(false)}
      >
        <form className="space-y-3 text-sm">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Title</label>
            <input
              className="w-full rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              placeholder="e.g. Yearbook 2015"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              Collection
            </label>
            <select className="w-full rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-white focus:outline-none">
              <option>Yearbooks</option>
              <option>Research Journals</option>
              <option>Newsletters</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              Notes (optional)
            </label>
            <textarea
              rows={3}
              className="w-full rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              placeholder="Short description, source, etc."
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="rounded-md border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800"
              onClick={() => setNewRecordOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-md bg-sky-600 px-3 py-2 text-xs font-medium text-white hover:bg-sky-500"
            >
              Save record
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
