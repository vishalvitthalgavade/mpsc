import { useContext } from "react";
import { StudyContext } from "./StudyContext";

export function useStudy() {
  const context = useContext(StudyContext);

  if (!context) {
    throw new Error(
      "useStudy must be used inside StudyProvider"
    );
  }

  return context;
}