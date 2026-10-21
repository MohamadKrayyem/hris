import { useState } from "react";
import { Briefcase, Eye, EyeOff } from "lucide-react";
import { login, type User } from "../api";

type Props = { onLogin: (user: User) => void; sessionMessage?: string };

export default function LoginPage({ onLogin, sessionMessage }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); // Stop the page from reloading (Enter also submits the form)
    if (!email.trim() || !password) return setError("Please enter your email and password.");

    setError("");
    setLoading(true);
    try {
      onLogin(await login(email.trim(), password));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <Briefcase size={26} /> HRIS
        </div>
        <p className="login-subtitle">Sign in to your account</p>

        {sessionMessage && !error && <div className="info-box">{sessionMessage}</div>}

        {/* noValidate turns off the browser's popups so our own red message is shown instead */}
        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <label className="field">
            Email
            {/* maxLength matches the backend limit */}
            <input type="email" maxLength={150} autoComplete="username" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>

          <label className="field">
            Password
            <span className="password-wrap">
              <input
                type={showPassword ? "text" : "password"}
                maxLength={100}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                {showPassword ? "Hide" : "Show"}
              </button>
            </span>
          </label>

          {error && <div className="error-box">{error}</div>}

          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <div className="login-demo">
          Demo account: <strong>admin@hris.com</strong> / <strong>Admin123!</strong>
        </div>
      </div>
    </div>
  );
}
