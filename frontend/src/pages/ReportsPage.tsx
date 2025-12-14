// src/pages/ReportsPage.tsx
export default function ReportsPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold mb-2 text-white">Reports & Logs</h1>
      <p className="text-slate-300 text-sm mb-4">
        Review activity logs and key archive statistics.
      </p>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs text-slate-400">Actions today</p>
          <p className="mt-2 text-2xl font-semibold text-white">182</p>
          <p className="mt-1 text-xs text-emerald-400">+12% vs yesterday</p>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs text-slate-400">Files uploaded this week</p>
          <p className="mt-2 text-2xl font-semibold text-white">57</p>
          <p className="mt-1 text-xs text-sky-400">Yearbooks & journals</p>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs text-slate-400">Records edited</p>
          <p className="mt-2 text-2xl font-semibold text-white">34</p>
          <p className="mt-1 text-xs text-amber-400">Awaiting QA review</p>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs text-slate-400">Failed actions</p>
          <p className="mt-2 text-2xl font-semibold text-white">3</p>
          <p className="mt-1 text-xs text-rose-400">Check error logs</p>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-sm">
        <div className="flex gap-2">
          <select className="rounded-md border border-slate-700 bg-slate-900/60 px-2 py-2 text-white focus:outline-none">
            <option>All actions</option>
            <option>Uploads</option>
            <option>Edits</option>
            <option>Deletes</option>
            <option>Logins</option>
          </select>
          <select className="rounded-md border border-slate-700 bg-slate-900/60 px-2 py-2 text-white focus:outline-none">
            <option>All users</option>
            <option>QA Admin</option>
            <option>Librarians</option>
            <option>Staff</option>
          </select>
        </div>

        <div className="flex gap-2">
          <input
            className="rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            placeholder="Search in logs..."
          />
          <select className="rounded-md border border-slate-700 bg-slate-900/60 px-2 py-2 text-white focus:outline-none">
            <option>Last 24 hours</option>
            <option>Last 7 days</option>
            <option>Last 30 days</option>
          </select>
        </div>
      </div>

      {/* Activity log table */}
      <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-sm">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold uppercase text-slate-400">
            Activity log
          </p>
          <p className="text-xs text-slate-500">Most recent 20 actions</p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-800 text-xs uppercase text-slate-400">
              <tr>
                <th className="py-2 pr-4">Time</th>
                <th className="py-2 pr-4">User</th>
                <th className="py-2 pr-4">Action</th>
                <th className="py-2 pr-4">Target</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              <tr className="hover:bg-slate-800/60">
                <td className="py-2 pr-4 text-slate-400">5 min ago</td>
                <td className="py-2 pr-4 text-white">Librarian Jane</td>
                <td className="py-2 pr-4 text-white">Uploaded file</td>
                <td className="py-2 pr-4 text-slate-400">Yearbook_2015.pdf</td>
                <td className="py-2 pr-4">
                  <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-300">
                    Success
                  </span>
                </td>
                <td className="py-2 pr-4">
                  <button className="text-xs text-sky-400 hover:underline">
                    View
                  </button>
                </td>
              </tr>

              <tr className="hover:bg-slate-800/60">
                <td className="py-2 pr-4 text-slate-400">32 min ago</td>
                <td className="py-2 pr-4 text-white">QA Admin</td>
                <td className="py-2 pr-4 text-white">Approved edit</td>
                <td className="py-2 pr-4 text-slate-400">
                  Research_Journal_v3
                </td>
                <td className="py-2 pr-4">
                  <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-300">
                    Success
                  </span>
                </td>
                <td className="py-2 pr-4">
                  <button className="text-xs text-sky-400 hover:underline">
                    View
                  </button>
                </td>
              </tr>

              <tr className="hover:bg-slate-800/60">
                <td className="py-2 pr-4 text-slate-400">2 hrs ago</td>
                <td className="py-2 pr-4 text-white">Staff Mark</td>
                <td className="py-2 pr-4 text-white">Delete request</td>
                <td className="py-2 pr-4 text-slate-400">
                  Campus_Newsletter.png
                </td>
                <td className="py-2 pr-4">
                  <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-300">
                    Pending
                  </span>
                </td>
                <td className="py-2 pr-4">
                  <button className="text-xs text-sky-400 hover:underline">
                    Review
                  </button>
                </td>
              </tr>

              <tr className="hover:bg-slate-800/60">
                <td className="py-2 pr-4 text-slate-400">3 hrs ago</td>
                <td className="py-2 pr-4 text-white">Unknown</td>
                <td className="py-2 pr-4 text-white">Failed login</td>
                <td className="py-2 pr-4 text-slate-400">
                  [qa.admin@fildas.edu](mailto:qa.admin@fildas.edu)
                </td>
                <td className="py-2 pr-4">
                  <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-xs text-rose-300">
                    Failed
                  </span>
                </td>
                <td className="py-2 pr-4">
                  <button className="text-xs text-sky-400 hover:underline">
                    Details
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
