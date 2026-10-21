// Gives TypeScript the type of import.meta.env (Vite's environment variables)
/// <reference types="vite/client" />

// The API address. Online, set VITE_API_URL when building; locally it falls back to http://localhost:5000
const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const API_URL = `${BASE_URL}/employees`;
const TOKEN_KEY = "hris-token";
const USER_KEY = "hris-user";

// The allowed values, shared by the form and the filters
export const STATUSES = ["Active", "On Leave", "Resigned"] as const;
export const EMPLOYMENT_TYPES = ["Full-time", "Part-time", "Contract"] as const;

export type Employee = {
  id: number;
  name: string;
  email: string;
  role: string;
  department: string;
  salary: number;
  hireDate: string; // "YYYY-MM-DD"
  status: "Active" | "On Leave" | "Resigned";
  employmentType: "Full-time" | "Part-time" | "Contract";
};

export type User = { name: string; email: string };

// localStorage can throw (private mode, blocked storage), so every call is wrapped in try/catch
function readStorage(key: string) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function writeStorage(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
}
function removeStorage(key: string) {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

// Log in and remember the token. Throws the backend's message if it fails.
export async function login(email: string, password: string): Promise<User> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    throw new Error("Cannot connect to the server. Is the backend running?");
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error ?? "Sign in failed. Please try again.");

  const user: User = { name: body.name, email: body.email };
  writeStorage(TOKEN_KEY, body.token);
  writeStorage(USER_KEY, JSON.stringify(user));
  return user;
}

// Forget the token and the user, so nobody can reuse them from this browser
export function logout() {
  removeStorage(TOKEN_KEY);
  removeStorage(USER_KEY);
}

// The logged-in user, or null if there is no token or it has expired
export function getCurrentUser(): User | null {
  const token = readStorage(TOKEN_KEY);
  const saved = readStorage(USER_KEY);
  if (!token || !saved) return null;
  try {
    // A JWT is "header.payload.signature". The payload is base64url JSON with "exp" (seconds).
    // This only hides the app early; the server still checks the signature on every request.
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    if (Date.now() >= payload.exp * 1000) {
      logout();
      return null;
    }
    return JSON.parse(saved);
  } catch {
    logout(); // A broken token: forget it
    return null;
  }
}

// Headers for employee requests: JSON + the token that proves who we are
function authHeaders() {
  return { "Content-Type": "application/json", Authorization: `Bearer ${readStorage(TOKEN_KEY) ?? ""}` };
}

// If the request failed, throw an Error with the backend's message
async function check(res: Response) {
  if (res.status === 401) {
    // The token is missing, wrong or expired: log out so the login page shows
    logout();
    throw new Error("SESSION_EXPIRED");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null); // Some errors (like 404) have no body
    throw new Error(body?.error ?? `Request failed (status ${res.status}).`);
  }
  return res;
}

// The backend sends "2024-01-15T00:00:00"; keep only "2024-01-15"
function fixDate(emp: Employee): Employee {
  return { ...emp, hireDate: emp.hireDate.slice(0, 10) };
}

// GET all employees
export async function getEmployees(): Promise<Employee[]> {
  const res = await check(await fetch(API_URL, { headers: authHeaders() }));
  const data: Employee[] = await res.json();
  return data.map(fixDate);
}

// POST a new employee; the server returns it with its new id
export async function addEmployee(emp: Employee): Promise<Employee> {
  const res = await check(await fetch(API_URL, { method: "POST", headers: authHeaders(), body: JSON.stringify(emp) }));
  return fixDate(await res.json());
}

// PUT changes to an existing employee
export async function updateEmployee(emp: Employee) {
  await check(await fetch(`${API_URL}/${emp.id}`, { method: "PUT", headers: authHeaders(), body: JSON.stringify(emp) }));
}

// DELETE an employee by id
export async function deleteEmployee(id: number) {
  await check(await fetch(`${API_URL}/${id}`, { method: "DELETE", headers: authHeaders() }));
}
