import { useState } from "react";
import { Employee, EMPLOYMENT_TYPES, STATUSES } from "../api";

type Props = { editing: Employee | null; onSave: (emp: Employee) => Promise<void>; onCancel: () => void };

// Today's date as "YYYY-MM-DD" in local time
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// A blank employee for the "Add" form (a function, so the hire date is always today)
function newEmployee(): Employee {
  return { id: 0, name: "", email: "", role: "", department: "", salary: 0, hireDate: today(), status: "Active", employmentType: "Full-time" };
}

// Same rules as the backend. Returns an error message, or "" if valid.
// (This is only for a nice user experience; the server checks everything again.)
function validate(f: Employee) {
  if (!f.name || !f.email || !f.role || !f.department) return "Name, email, role and department are required.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) return "Please enter a valid email address.";
  if (f.salary < 0 || f.salary > 10000000) return "Salary must be between 0 and 10,000,000.";
  if (!f.hireDate) return "Hire date is required.";
  // "YYYY-MM-DD" strings compare like dates
  if (f.hireDate > today()) return "Hire date cannot be in the future.";
  if (f.hireDate < "1950-01-01") return "Hire date cannot be before 1950.";
  return "";
}

export default function EmployeeForm({ editing, onSave, onCancel }: Props) {
  // Start with the employee being edited, or a blank one
  const [form, setForm] = useState<Employee>(editing ?? newEmployee());
  const [error, setError] = useState("");

  // Change one field of the form
  function set<K extends keyof Employee>(key: K, value: Employee[K]) {
    setForm({ ...form, [key]: value });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); // Stop the page from reloading
    // Remove spaces at the start and end before checking and saving
    const clean = { ...form, name: form.name.trim(), email: form.email.trim(), role: form.role.trim(), department: form.department.trim() };
    const message = validate(clean);
    if (message) return setError(message);
    try {
      await onSave(clean);
      setForm(newEmployee());
      setError("");
    } catch (err) {
      // The backend rejected it: show its message
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  return (
    // noValidate turns off the browser's popups so our own red message is shown instead
    <form onSubmit={handleSubmit} noValidate>
      <div className="form-grid">
        {/* maxLength / min / max match the backend limits and the database column sizes */}
        <label className="field">
          Name
          <input maxLength={100} value={form.name} onChange={(e) => set("name", e.target.value)} />
        </label>
        <label className="field">
          Email
          <input type="email" maxLength={150} value={form.email} onChange={(e) => set("email", e.target.value)} />
        </label>
        <label className="field">
          Role
          <input maxLength={100} value={form.role} onChange={(e) => set("role", e.target.value)} />
        </label>
        <label className="field">
          Department
          <input maxLength={100} value={form.department} onChange={(e) => set("department", e.target.value)} />
        </label>
        <label className="field">
          Salary
          <input type="number" min={0} max={10000000} value={form.salary} onChange={(e) => set("salary", Number(e.target.value))} />
        </label>
        <label className="field">
          Hire Date
          <input type="date" min="1950-01-01" max={today()} value={form.hireDate} onChange={(e) => set("hireDate", e.target.value)} />
        </label>
        <label className="field">
          Status
          <select value={form.status} onChange={(e) => set("status", e.target.value as Employee["status"])}>
            {STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        <label className="field">
          Employment Type
          <select value={form.employmentType} onChange={(e) => set("employmentType", e.target.value as Employee["employmentType"])}>
            {EMPLOYMENT_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </label>
      </div>

      {error && <div className="error-box">{error}</div>}

      <div className="form-actions">
        <button className="btn btn-primary" type="submit">{editing ? "Update employee" : "Add employee"}</button>
        {editing && <button className="btn btn-secondary" type="button" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  );
}
