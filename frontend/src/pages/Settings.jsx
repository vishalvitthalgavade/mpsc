import {
  User,
  Mail,
  Settings as SettingsIcon,
  Sun,
  Moon,
  ShieldCheck,
  LogOut,
  Lock,
  Save,
  CheckCircle,
  AlertCircle,
  CalendarDays,
} from "lucide-react";

import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useNavigate } from "react-router-dom";
import { readExamDate, saveExamDate, useExamCountdown } from "../context/useExamCountdown";

export default function Settings() {
  const {
    user,
    logout,
    updateProfile,
    changePassword,
    mustChangePassword,
  } = useAuth();

  const { theme, toggleTheme } =
    useTheme();

  const navigate = useNavigate();

  const isDark = theme === "dark";
  const { examDate, daysLeft, isPast } = useExamCountdown();
  const [examDateDraft, setExamDateDraft] = useState(readExamDate);
  const [examDateMessage, setExamDateMessage] = useState("");

  useEffect(() => {
    setExamDateDraft(examDate);
  }, [examDate]);

  function handleExamDateSave(event) {
    event.preventDefault();
    if (examDateDraft && Number.isNaN(new Date(`${examDateDraft}T00:00:00`).getTime())) {
      setExamDateMessage("Choose a valid exam date.");
      return;
    }
    saveExamDate(examDateDraft);
    setExamDateMessage(examDateDraft ? "Exam date saved. Countdown updated." : "Exam date cleared.");
  }

  /*
  ====================================================
  PROFILE STATE
  ====================================================
  */

  const [name, setName] =
    useState(user?.name || "");

  const [isSavingProfile, setIsSavingProfile] =
    useState(false);

  const [profileMessage, setProfileMessage] =
    useState("");

  const [profileError, setProfileError] =
    useState("");

  /*
  ====================================================
  PASSWORD STATE
  ====================================================
  */

  const [currentPassword, setCurrentPassword] =
    useState("");

  const [newPassword, setNewPassword] =
    useState("");

  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [isChangingPassword, setIsChangingPassword] =
    useState(false);

  const [passwordMessage, setPasswordMessage] =
    useState("");

  const [passwordError, setPasswordError] =
    useState("");

  /*
  ====================================================
  KEEP NAME FIELD IN SYNC
  ====================================================
  */

  useEffect(() => {
    setName(user?.name || "");
  }, [user?.name]);

  /*
  ====================================================
  SAVE PROFILE
  ====================================================
  */

  async function handleProfileSave(event) {
    event.preventDefault();

    setProfileMessage("");
    setProfileError("");

    const trimmedName =
      name.trim();

    if (!trimmedName) {
      setProfileError(
        "Name is required."
      );
      return;
    }

    if (trimmedName.length < 2) {
      setProfileError(
        "Name must be at least 2 characters."
      );
      return;
    }

    if (trimmedName.length > 100) {
      setProfileError(
        "Name cannot exceed 100 characters."
      );
      return;
    }

    setIsSavingProfile(true);

    try {
      await updateProfile(
        trimmedName
      );

      setName(trimmedName);

      setProfileMessage(
        "Profile updated successfully."
      );
    } catch (error) {
      setProfileError(
        error?.message ||
          "Could not update profile."
      );
    } finally {
      setIsSavingProfile(false);
    }
  }

  /*
  ====================================================
  CHANGE PASSWORD
  ====================================================
  */

  async function handleChangePassword(
    event
  ) {
    event.preventDefault();

    setPasswordMessage("");
    setPasswordError("");

    if (!currentPassword) {
      setPasswordError(
        "Enter your current password."
      );
      return;
    }

    if (!newPassword) {
      setPasswordError(
        "Enter a new password."
      );
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError(
        "New password must be at least 8 characters."
      );
      return;
    }

    if (newPassword.length > 128) {
      setPasswordError(
        "New password cannot exceed 128 characters."
      );
      return;
    }

    if (
      newPassword !==
      confirmPassword
    ) {
      setPasswordError(
        "New passwords do not match."
      );
      return;
    }

    if (
      currentPassword ===
      newPassword
    ) {
      setPasswordError(
        "New password must be different from the current password."
      );
      return;
    }

    setIsChangingPassword(true);

    try {
      await changePassword(
        currentPassword,
        newPassword
      );

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      setPasswordMessage(
        "Password changed successfully. Your temporary password is no longer valid."
      );
    } catch (error) {
      setPasswordError(
        error?.message ||
          "Could not change password."
      );
    } finally {
      setIsChangingPassword(false);
    }
  }

  /*
  ====================================================
  LOGOUT
  ====================================================
  */

  async function handleLogout() {
    await logout();

    navigate("/login", {
      replace: true,
    });
  }

  const initial =
    user?.name
      ?.trim()
      ?.charAt(0)
      ?.toUpperCase() || "U";

  /*
  ====================================================
  COMMON STYLES
  ====================================================
  */

  const cardClass = isDark
    ? "border-zinc-800 bg-zinc-900/80"
    : "border-gray-200 bg-white";

  const inputClass = isDark
    ? "border-zinc-800 bg-zinc-950 text-white placeholder:text-zinc-600 focus:border-purple-500"
    : "border-gray-200 bg-gray-50 text-gray-900 placeholder:text-gray-400 focus:border-purple-500";

  return (
    <div
      className={`min-h-full w-full overflow-x-hidden px-3 py-4 sm:px-5 sm:py-6 lg:px-8 lg:py-8 ${
        isDark
          ? "bg-[#0b1120] text-white"
          : "bg-gray-50 text-gray-900"
      }`}
    >
      <div className="mx-auto w-full max-w-4xl space-y-4 sm:space-y-6">

        {/* ====================================================
            HEADER
        ==================================================== */}

        <div
          className={`rounded-2xl border p-5 shadow-sm sm:p-6 ${cardClass}`}
        >
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-purple-600/15 text-xl font-bold text-purple-400">
              {initial}
            </div>

            <div className="min-w-0">
              <h1 className="text-2xl font-bold sm:text-3xl">
                Settings
              </h1>

              <p
                className={`mt-1 text-sm ${
                  isDark
                    ? "text-zinc-500"
                    : "text-gray-500"
                }`}
              >
                Manage your account and app preferences.
              </p>
            </div>
          </div>
        </div>

        <section className={`rounded-2xl border p-5 shadow-sm sm:p-6 ${cardClass}`}>
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-xl bg-purple-500/10 p-2.5 text-purple-400"><CalendarDays size={21} /></div>
            <div>
              <h2 className="font-semibold">MPSC exam countdown</h2>
              <p className={`mt-1 text-sm ${isDark ? "text-zinc-500" : "text-gray-500"}`}>Set or update your exam date to change the countdown.</p>
            </div>
          </div>
          <form onSubmit={handleExamDateSave} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex-1 text-sm font-medium">
              Exam date
              <input
                type="date"
                value={examDateDraft}
                onChange={(event) => { setExamDateDraft(event.target.value); setExamDateMessage(""); }}
                className={`mt-1.5 block w-full rounded-xl border px-3 py-2.5 outline-none focus:ring-2 focus:ring-purple-500/30 ${inputClass}`}
              />
            </label>
            <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-purple-500">
              <Save size={16} /> Save date
            </button>
          </form>
          {examDateMessage && <p role="status" className="mt-3 text-sm text-emerald-500">{examDateMessage}</p>}
          {examDate && <p className={`mt-3 text-sm ${isDark ? "text-zinc-400" : "text-gray-600"}`}>
            {isPast ? "Selected exam date has passed." : `${daysLeft} day${daysLeft === 1 ? "" : "s"} remaining.`}
          </p>}
          <p className={`mt-2 text-xs ${isDark ? "text-zinc-600" : "text-gray-400"}`}>The date is saved in this browser and can be changed any time.</p>
        </section>

        {/* ====================================================
            FORCE PASSWORD CHANGE NOTICE
        ==================================================== */}

        {mustChangePassword && (
          <section className="rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-5 shadow-sm sm:p-6">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-yellow-500/10 p-2.5 text-yellow-400">
                <AlertCircle size={21} />
              </div>

              <div>
                <h2 className="font-semibold text-yellow-300">
                  Password change required
                </h2>

                <p className="mt-1 text-sm leading-6 text-yellow-200/80">
                  An administrator reset your password.
                  You are currently using a temporary
                  password. Please create a new permanent
                  password below.
                </p>
              </div>
            </div>
          </section>
        )}

        {/* ====================================================
            PROFILE
        ==================================================== */}

        <section
          className={`rounded-2xl border p-5 shadow-sm sm:p-6 ${cardClass}`}
        >
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-xl bg-purple-500/10 p-2.5 text-purple-400">
              <User size={21} />
            </div>

            <div>
              <h2 className="font-semibold">
                Profile
              </h2>

              <p
                className={`text-xs ${
                  isDark
                    ? "text-zinc-500"
                    : "text-gray-500"
                }`}
              >
                Update your account information
              </p>
            </div>
          </div>

          <form
            onSubmit={handleProfileSave}
          >
            <div className="grid gap-4 sm:grid-cols-2">

              {/* NAME */}

              <div>
                <label
                  htmlFor="settings-name"
                  className={`mb-2 block text-xs font-medium ${
                    isDark
                      ? "text-zinc-400"
                      : "text-gray-500"
                  }`}
                >
                  Name
                </label>

                <div
                  className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition focus-within:ring-2 focus-within:ring-purple-500/20 ${inputClass}`}
                >
                  <User
                    size={18}
                    className="shrink-0 text-purple-400"
                  />

                  <input
                    id="settings-name"
                    type="text"
                    value={name}
                    onChange={(event) =>
                      setName(
                        event.target.value
                      )
                    }
                    maxLength={100}
                    placeholder="Enter your name"
                    className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                  />
                </div>
              </div>

              {/* EMAIL */}

              <div>
                <label
                  htmlFor="settings-email"
                  className={`mb-2 block text-xs font-medium ${
                    isDark
                      ? "text-zinc-400"
                      : "text-gray-500"
                  }`}
                >
                  Email
                </label>

                <div
                  className={`flex items-center gap-3 rounded-xl border px-4 py-3 opacity-70 ${inputClass}`}
                >
                  <Mail
                    size={18}
                    className="shrink-0 text-purple-400"
                  />

                  <input
                    id="settings-email"
                    type="email"
                    value={user?.email || ""}
                    disabled
                    readOnly
                    className="min-w-0 cursor-not-allowed flex-1 bg-transparent text-sm outline-none"
                  />
                </div>

                <p
                  className={`mt-2 text-[11px] ${
                    isDark
                      ? "text-zinc-600"
                      : "text-gray-400"
                  }`}
                >
                  Email address cannot be changed.
                </p>
              </div>
            </div>

            {profileMessage && (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm text-green-400">
                <CheckCircle size={17} />
                <span>
                  {profileMessage}
                </span>
              </div>
            )}

            {profileError && (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                <AlertCircle size={17} />
                <span>
                  {profileError}
                </span>
              </div>
            )}

            <div className="mt-5 flex justify-end">
              <button
                type="submit"
                disabled={
                  isSavingProfile
                }
                className="flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save size={17} />

                {isSavingProfile
                  ? "Saving..."
                  : "Save Changes"}
              </button>
            </div>
          </form>
        </section>

        {/* ====================================================
            SECURITY / CHANGE PASSWORD
        ==================================================== */}

        <section
          className={`rounded-2xl border p-5 shadow-sm sm:p-6 ${
            mustChangePassword
              ? "border-yellow-500/40"
              : cardClass
          }`}
        >
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-xl bg-blue-500/10 p-2.5 text-blue-400">
              <Lock size={21} />
            </div>

            <div>
              <h2 className="font-semibold">
                {mustChangePassword
                  ? "Create New Password"
                  : "Change Password"}
              </h2>

              <p
                className={`text-xs ${
                  isDark
                    ? "text-zinc-500"
                    : "text-gray-500"
                }`}
              >
                {mustChangePassword
                  ? "Replace your temporary password with a permanent password."
                  : "Update your account password"}
              </p>
            </div>
          </div>

          <form
            onSubmit={handleChangePassword}
          >
            <div className="space-y-4">

              {/* CURRENT PASSWORD */}

              <div>
                <label
                  htmlFor="current-password"
                  className={`mb-2 block text-xs font-medium ${
                    isDark
                      ? "text-zinc-400"
                      : "text-gray-500"
                  }`}
                >
                  Current Password
                </label>

                <div
                  className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition focus-within:ring-2 focus-within:ring-purple-500/20 ${inputClass}`}
                >
                  <Lock
                    size={18}
                    className="shrink-0 text-blue-400"
                  />

                  <input
                    id="current-password"
                    type="password"
                    value={
                      currentPassword
                    }
                    onChange={(event) =>
                      setCurrentPassword(
                        event.target.value
                      )
                    }
                    autoComplete="current-password"
                    placeholder={
                      mustChangePassword
                        ? "Enter temporary password"
                        : "Enter current password"
                    }
                    className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                  />
                </div>
              </div>

              {/* NEW PASSWORD */}

              <div>
                <label
                  htmlFor="new-password"
                  className={`mb-2 block text-xs font-medium ${
                    isDark
                      ? "text-zinc-400"
                      : "text-gray-500"
                  }`}
                >
                  New Password
                </label>

                <div
                  className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition focus-within:ring-2 focus-within:ring-purple-500/20 ${inputClass}`}
                >
                  <Lock
                    size={18}
                    className="shrink-0 text-blue-400"
                  />

                  <input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(event) =>
                      setNewPassword(
                        event.target.value
                      )
                    }
                    autoComplete="new-password"
                    placeholder="Enter new password"
                    className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                  />
                </div>

                <p
                  className={`mt-2 text-[11px] ${
                    isDark
                      ? "text-zinc-600"
                      : "text-gray-400"
                  }`}
                >
                  Minimum 8 characters.
                </p>
              </div>

              {/* CONFIRM PASSWORD */}

              <div>
                <label
                  htmlFor="confirm-password"
                  className={`mb-2 block text-xs font-medium ${
                    isDark
                      ? "text-zinc-400"
                      : "text-gray-500"
                  }`}
                >
                  Confirm New Password
                </label>

                <div
                  className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition focus-within:ring-2 focus-within:ring-purple-500/20 ${inputClass}`}
                >
                  <Lock
                    size={18}
                    className="shrink-0 text-blue-400"
                  />

                  <input
                    id="confirm-password"
                    type="password"
                    value={
                      confirmPassword
                    }
                    onChange={(event) =>
                      setConfirmPassword(
                        event.target.value
                      )
                    }
                    autoComplete="new-password"
                    placeholder="Confirm new password"
                    className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                  />
                </div>
              </div>
            </div>

            {passwordMessage && (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm text-green-400">
                <CheckCircle size={17} />
                <span>
                  {passwordMessage}
                </span>
              </div>
            )}

            {passwordError && (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                <AlertCircle size={17} />
                <span>
                  {passwordError}
                </span>
              </div>
            )}

            <div className="mt-5 flex justify-end">
              <button
                type="submit"
                disabled={
                  isChangingPassword
                }
                className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Lock size={17} />

                {isChangingPassword
                  ? "Changing..."
                  : mustChangePassword
                  ? "Set Permanent Password"
                  : "Change Password"}
              </button>
            </div>
          </form>
        </section>

        {/* ====================================================
            APPEARANCE
        ==================================================== */}

        <section
          className={`rounded-2xl border p-5 shadow-sm sm:p-6 ${cardClass}`}
        >
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-xl bg-purple-500/10 p-2.5 text-purple-400">
              <SettingsIcon size={21} />
            </div>

            <div>
              <h2 className="font-semibold">
                Appearance
              </h2>

              <p
                className={`text-xs ${
                  isDark
                    ? "text-zinc-500"
                    : "text-gray-500"
                }`}
              >
                Customize how the tracker looks
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={toggleTheme}
            className={`flex w-full items-center justify-between rounded-xl border p-4 text-left transition ${
              isDark
                ? "border-zinc-800 bg-zinc-950 hover:border-zinc-700"
                : "border-gray-200 bg-gray-50 hover:border-gray-300"
            }`}
          >
            <div className="flex items-center gap-3">
              {isDark ? (
                <Moon
                  size={20}
                  className="text-purple-400"
                />
              ) : (
                <Sun
                  size={20}
                  className="text-purple-500"
                />
              )}

              <div>
                <p className="text-sm font-medium">
                  {isDark
                    ? "Dark Mode"
                    : "Light Mode"}
                </p>

                <p
                  className={`mt-0.5 text-xs ${
                    isDark
                      ? "text-zinc-500"
                      : "text-gray-500"
                  }`}
                >
                  Click to switch theme
                </p>
              </div>
            </div>

            <div
              className={`relative h-6 w-11 rounded-full ${
                isDark
                  ? "bg-purple-600"
                  : "bg-gray-300"
              }`}
            >
              <div
                className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                  isDark
                    ? "translate-x-6"
                    : "translate-x-1"
                }`}
              />
            </div>
          </button>
        </section>

        {/* ====================================================
            ACCOUNT
        ==================================================== */}

        <section
          className={`rounded-2xl border p-5 shadow-sm sm:p-6 ${cardClass}`}
        >
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-xl bg-green-500/10 p-2.5 text-green-400">
              <ShieldCheck size={21} />
            </div>

            <div>
              <h2 className="font-semibold">
                Account
              </h2>

              <p
                className={`text-xs ${
                  isDark
                    ? "text-zinc-500"
                    : "text-gray-500"
                }`}
              >
                Manage your signed-in account
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition ${
              isDark
                ? "border-red-500/10 text-red-400 hover:bg-red-950/30"
                : "border-red-100 text-red-600 hover:bg-red-50"
            }`}
          >
            <LogOut size={18} />
            Logout
          </button>
        </section>

      </div>
    </div>
  );
}
