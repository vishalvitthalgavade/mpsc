import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check, Eye, EyeOff, LockKeyhole, Mail, UserPlus, UserRound } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function Signup() {
  const navigate = useNavigate();
  const { signup } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 8) {
      setError("Password must contain at least 8 characters.");
      return;
    }

    setIsSubmitting(true);

    try {
      await signup(name, email, password);
      navigate("/timer");
    } catch (error) {
      setError(error.message || "Unable to create account.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="gate-auth-shell gate-auth-shell-signup">
      <div className="gate-auth-orb gate-auth-orb-one" aria-hidden="true" />
      <div className="gate-auth-orb gate-auth-orb-two" aria-hidden="true" />

      <div className="gate-auth-frame">
        <div className="gate-auth-brand">
          <div className="gate-brand-mark"><span>M</span></div>
          <div>
            <p className="gate-auth-brand-title">MPSC Rajyaseva</p>
            <p className="gate-auth-brand-subtitle">Study Tracker</p>
          </div>
        </div>

        <div className="gate-auth-card">
          <div className="gate-auth-heading">
            <div className="gate-auth-icon"><UserPlus size={19} /></div>
            <div>
              <h1>Create your account</h1>
              <p>Start tracking your MPSC Rajyaseva preparation.</p>
            </div>
          </div>

          {error && (
            <div className="gate-auth-error" role="alert">
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="gate-auth-form">
            <div className="gate-field">
              <label htmlFor="signup-name">Name</label>
              <div className="gate-input-wrap">
                <UserRound size={18} aria-hidden="true" />
                <input id="signup-name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="name" required />
              </div>
            </div>

            <div className="gate-field">
              <label htmlFor="signup-email">Email</label>
              <div className="gate-input-wrap">
                <Mail size={18} aria-hidden="true" />
                <input id="signup-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required />
              </div>
            </div>

            <div className="gate-field">
              <label htmlFor="signup-password">Password</label>
              <div className="gate-input-wrap">
                <LockKeyhole size={18} aria-hidden="true" />
                <input id="signup-password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimum 8 characters" autoComplete="new-password" required />
                <button type="button" className="gate-password-toggle" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <div className="gate-password-hint"><Check size={13} /> At least 8 characters</div>
            </div>

            <div className="gate-field">
              <label htmlFor="signup-confirm-password">Confirm Password</label>
              <div className="gate-input-wrap">
                <LockKeyhole size={18} aria-hidden="true" />
                <input id="signup-confirm-password" type={showConfirmPassword ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repeat your password" autoComplete="new-password" required />
                <button type="button" className="gate-password-toggle" onClick={() => setShowConfirmPassword(!showConfirmPassword)} aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}>
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={isSubmitting} className="gate-auth-submit">
              {isSubmitting ? (
                <><span className="gate-button-spinner" /> Creating account...</>
              ) : (
                <>Create Account <span aria-hidden="true">→</span></>
              )}
            </button>
          </form>

          <p className="gate-auth-switch">
            Already have an account? <Link to="/login">Login <span aria-hidden="true">→</span></Link>
          </p>
        </div>
      </div>
    </div>
  );
}
