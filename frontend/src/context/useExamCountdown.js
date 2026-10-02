import { useEffect, useState } from "react";

export const EXAM_DATE_STORAGE_KEY = "mpsc-rajyaseva-exam-date";
const EXAM_DATE_EVENT = "mpsc-exam-date-change";

export function readExamDate() {
  try {
    return localStorage.getItem(EXAM_DATE_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

export function saveExamDate(date) {
  try {
    if (date) {
      localStorage.setItem(EXAM_DATE_STORAGE_KEY, date);
    } else {
      localStorage.removeItem(EXAM_DATE_STORAGE_KEY);
    }
    window.dispatchEvent(new Event(EXAM_DATE_EVENT));
  } catch {
    // A blocked local storage setting should not break the app.
  }
}

export function useExamCountdown() {
  const [examDate, setExamDate] = useState(readExamDate);
  const [, setClock] = useState(Date.now());

  useEffect(() => {
    const refreshDate = () => setExamDate(readExamDate());
    const refreshClock = () => setClock(Date.now());
    window.addEventListener(EXAM_DATE_EVENT, refreshDate);
    window.addEventListener("storage", refreshDate);
    const interval = window.setInterval(refreshClock, 60_000);

    return () => {
      window.removeEventListener(EXAM_DATE_EVENT, refreshDate);
      window.removeEventListener("storage", refreshDate);
      window.clearInterval(interval);
    };
  }, []);

  if (!examDate) return { examDate, daysLeft: null, isPast: false };

  const [year, month, day] = examDate.split("-").map(Number);
  const examDay = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysLeft = Math.round((examDay.getTime() - today.getTime()) / 86_400_000);

  return { examDate, daysLeft: Math.max(0, daysLeft), isPast: daysLeft < 0 };
}
