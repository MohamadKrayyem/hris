import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import {
  Employee, User, STATUSES,
  getEmployees, addEmployee, updateEmployee, deleteEmployee, getCurrentUser, logout,
} from "./api";
import EmployeeForm from "./components/EmployeeForm";
import EmployeeTable from "./components/EmployeeTable";
import LoginPage from "./components/LoginPage";
import ReportCards from "./components/ReportCards";
import Sidebar, { type Page } from "./components/Sidebar";

// api.ts throws this when the token is missing or expired (the server answered 401)
const isSessionExpired = (err: unknown) => err instanceof Error && err.message === "SESSION_EXPIRED";

export default function App() {
  const [user, setUser] = useState<User | null>(getCurrentUser); // Still logged in from last time?
  const [sessionMessage, setSessionMessage] = useState("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [activePage, setActivePage] = useState<Page>("employees");
  const [loadError, setLoadError] = useState("");
  const mainRef = useRef<HTMLElement>(null); // The scrolling main area

  // Load employees when a user is logged in
  useEffect(() => {
    if (!user) return;
    setLoadError("");
    getEmployees()
      .then(setEmployees)
      .catch((err) => {
        if (isSessionExpired(err)) handleSessionExpired();
        else setLoadError("Cannot connect to the server. Is the backend running?");
      });
  }, [user]);

  function handleLogin(loggedIn: User) {
    setSessionMessage("");
    setUser(loggedIn);
  }

  function handleLogout() {
    logout();
    setUser(null);
    setEmployees([]);
    setEditing(null);
    setActivePage("employees");
  }

  function handleSessionExpired() {
    handleLogout();
    setSessionMessage("Your session expired. Please sign in again.");
  }

  // Called by the form. If the API throws, the error goes back to the form to show it.
  async function handleSave(emp: Employee) {
    try {
      if (emp.id) {
        // Existing employee (has an id): update it
        await updateEmployee(emp);
        setEmployees(employees.map((e) => (e.id === emp.id ? emp : e)));
        setEditing(null);
      } else {
        // New employee: the server gives back the saved row with its id
        const added = await addEmployee(emp);
        setEmployees([...employees, added]);
      }
    } catch (err) {
      if (isSessionExpired(err)) return handleSessionExpired();
      throw err; // Other errors are shown by the form
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteEmployee(id);
      setEmployees(employees.filter((e) => e.id !== id));
    } catch (err) {
      if (isSessionExpired(err)) return handleSessionExpired();
      alert(err instanceof Error ? err.message : "Could not remove the employee.");
    }
  }

  function handleEdit(emp: Employee) {
    setEditing(emp);
    mainRef.current?.scrollTo({ top: 0, behavior: "smooth" }); // Scroll up so the form is visible
  }

  // Not logged in: show only the login page
  if (!user) return <LoginPage onLogin={handleLogin} sessionMessage={sessionMessage} />;

  // Unique department names for the filter dropdown
  const departments = [...new Set(employees.map((e) => e.department))].sort();

  // Show employees that match the search text AND both filters
  const text = search.toLowerCase();
  const visible = employees.filter(
    (e) =>
      (e.name.toLowerCase().includes(text) || e.email.toLowerCase().includes(text) || e.department.toLowerCase().includes(text)) &&
      (departmentFilter === "All" || e.department === departmentFilter) &&
      (statusFilter === "All" || e.status === statusFilter)
  );

  return (
    <div className="layout">
      <Sidebar activePage={activePage} onChange={setActivePage} userName={user.name} onLogout={handleLogout} />

      <main className="main" ref={mainRef}>
        <header className="topbar">
          <h1>{activePage === "employees" ? "Employees" : "Reports & Analytics"}</h1>
          {activePage === "employees" && (
            <div className="search">
              <Search size={16} />
              <input placeholder="Search name, email or department" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          )}
        </header>

        <div className="content">
          {loadError && <div className="error-box">{loadError}</div>}

          {activePage === "employees" ? (
            <>
              <div className="card">
                <h2 className="card-title">{editing ? "Edit employee" : "Add employee"}</h2>
                {/* key makes the form reset when we switch which employee is being edited */}
                <EmployeeForm key={editing?.id ?? "new"} editing={editing} onSave={handleSave} onCancel={() => setEditing(null)} />
              </div>

              <div className="card">
                <div className="filters">
                  <label className="field">
                    Department
                    <select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)}>
                      <option>All</option>
                      {departments.map((d) => <option key={d}>{d}</option>)}
                    </select>
                  </label>
                  <label className="field">
                    Status
                    <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                      <option>All</option>
                      {STATUSES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </label>
                </div>
                <EmployeeTable employees={visible} onEdit={handleEdit} onDelete={handleDelete} />
              </div>
            </>
          ) : (
            <ReportCards employees={employees} onView={() => setActivePage("employees")} />
          )}
        </div>
      </main>
    </div>
  );
}
