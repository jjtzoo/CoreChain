import { useLocalSearchParams } from "expo-router";

import { IntervalFormScreen } from "@/components/interval-form-screen";

/** Correct an interval already logged: a typo in a code, a wrong depth. */
export default function EditIntervalScreen() {
  const { intervalId } = useLocalSearchParams<{ intervalId: string }>();
  return <IntervalFormScreen key={intervalId} intervalId={intervalId} />;
}
