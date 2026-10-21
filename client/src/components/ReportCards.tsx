import { Building2, Calculator, CalendarPlus, UserCheck, Users, Wallet, type LucideIcon } from "lucide-react";
import { Employee } from "../api";

type Props = { employees: Employee[]; onView: () => void };

// Format a number as money, e.g. 52500 -> "$52,500"
function money(value: number) {
  return "$" + value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export default function ReportCards({ employees, onView }: Props) {
  const count = employees.length;
  const active = employees.filter((e) => e.status === "Active");
  const departments = new Set(employees.map((e) => e.department)); // A Set keeps only unique values
  const activePayroll = active.reduce((sum, e) => sum + e.salary, 0);
  const allSalaries = employees.reduce((sum, e) => sum + e.salary, 0);
  // "YYYY-MM-DD" strings sort like dates, so the biggest string is the latest hire
  const newest = employees.reduce<Employee | null>((best, e) => (!best || e.hireDate > best.hireDate ? e : best), null);

  // With no employees, every card shows "—"
  const show = (value: string) => (count === 0 ? "—" : value);

  const cards: { title: string; value: string; icon: LucideIcon }[] = [
    { title: "Total Employees", value: show(String(count)), icon: Users },
    { title: "Active Employees", value: show(String(active.length)), icon: UserCheck },
    { title: "Departments", value: show(String(departments.size)), icon: Building2 },
    { title: "Total Payroll (Active)", value: show(money(activePayroll)), icon: Wallet },
    { title: "Average Salary", value: show(money(allSalaries / count)), icon: Calculator },
    { title: "Newest Hire", value: show(newest?.name ?? ""), icon: CalendarPlus },
  ];

  return (
    <div className="report-grid">
      {cards.map(({ title, value, icon: Icon }) => (
        <div className="card report-card" key={title}>
          <Icon className="report-icon" size={28} strokeWidth={1.5} />
          <p className="report-title">{title}</p>
          <p className="report-value">{value}</p>
          <button className="btn btn-outline btn-sm" onClick={onView}>View employees</button>
        </div>
      ))}
    </div>
  );
}
