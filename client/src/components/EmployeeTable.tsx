import { Employee } from "../api";

type Props = { employees: Employee[]; onEdit: (emp: Employee) => void; onDelete: (id: number) => void };

// The CSS class for each status pill
const badgeClass: Record<Employee["status"], string> = {
  Active: "badge-active",
  "On Leave": "badge-leave",
  Resigned: "badge-resigned",
};

// "2024-01-15" -> "Jan 15, 2024" (the "T00:00:00" makes it local time, so the day doesn't shift)
function formatDate(date: string) {
  return new Date(date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function EmployeeTable({ employees, onEdit, onDelete }: Props) {
  if (employees.length === 0) return <p className="empty">No employees found.</p>;

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Employee</th>
            <th>Role</th>
            <th>Department</th>
            <th>Type</th>
            <th>Status</th>
            <th>Hire Date</th>
            <th>Salary</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {/* One row per employee; key helps React track rows */}
          {employees.map((emp) => (
            <tr key={emp.id}>
              <td>
                <div className="emp-name">{emp.name}</div>
                <div className="emp-email">{emp.email}</div>
              </td>
              <td>{emp.role}</td>
              <td>{emp.department}</td>
              <td>{emp.employmentType}</td>
              <td>
                <span className={`badge ${badgeClass[emp.status]}`}>{emp.status}</span>
              </td>
              <td>{formatDate(emp.hireDate)}</td>
              <td>${emp.salary.toLocaleString()}</td>
              <td className="actions">
                <button className="btn btn-sm btn-primary" onClick={() => onEdit(emp)}>Edit</button>
                <button className="btn btn-sm btn-danger" onClick={() => onDelete(emp.id)}>Remove</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
