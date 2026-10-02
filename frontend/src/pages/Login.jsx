import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, LockKeyhole, LogIn, Mail } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await login(email, password);
      navigate("/timer");
    } catch (error) {
      setError(error.message || "Unable to login.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="gate-auth-shell">
      <div className="gate-auth-orb gate-auth-orb-one" aria-hidden="true" />
      <div className="gate-auth-orb gate-auth-orb-two" aria-hidden="true" />

      <div className="gate-auth-frame">
        <div className="gate-auth-brand">
          <div className="gate-brand-mark">
            <span>M</span>
          </div>
          <div>
            <p className="gate-auth-brand-title">MPSC Rajyaseva</p>
            <p className="gate-auth-brand-subtitle">Study Tracker</p>
          </div>
        </div>

        <div className="gate-auth-card">
          <div className="gate-auth-heading">
            <div className="gate-auth-icon"><LogIn size={19} /></div>
            <div>
              <h1>Welcome back</h1>
              <p>Continue your MPSC Rajyaseva preparation.</p>
            </div>
          </div>

          {error && (
            <div className="gate-auth-error" role="alert">
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="gate-auth-form">
            <div className="gate-field">
              <label htmlFor="login-email">Email</label>
              <div className="gate-input-wrap">
                <Mail size={18} aria-hidden="true" />
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div className="gate-field">
              <label htmlFor="login-password">Password</label>
              <div className="gate-input-wrap">
                <LockKeyhole size={18} aria-hidden="true" />
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="gate-password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={isSubmitting} className="gate-auth-submit">
              {isSubmitting ? (
                <><span className="gate-button-spinner" /> Logging in...</>
              ) : (
                <>Login <span aria-hidden="true">→</span></>
              )}
            </button>
          </form>

          <p className="gate-auth-switch">
            Don't have an account? <Link to="/signup">Create one <span aria-hidden="true">→</span></Link>
          </p>
        </div>
      </div>
    </div>
  );
}
