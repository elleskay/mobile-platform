import { useState } from "react";
import { StyleSheet, Text, TextInput, Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { checkMessage, type CheckResult } from "@/lib/api";

export default function CheckScreen() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<CheckResult | null>(null);
  const [busy, setBusy] = useState(false);

  async function onCheck() {
    setBusy(true);
    try {
      setResult(await checkMessage(text));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.heading}>Check a message</Text>
      <TextInput
        testID="message-input"
        style={styles.input}
        placeholder="Paste a suspicious SMS or message"
        value={text}
        onChangeText={setText}
        multiline
      />
      <Pressable
        testID="check-button"
        style={[styles.button, (busy || !text) && styles.buttonDisabled]}
        disabled={busy || !text}
        onPress={onCheck}
      >
        <Text style={styles.buttonText}>{busy ? "Checking..." : "Check"}</Text>
      </Pressable>
      {result && (
        <View testID="verdict" style={styles.result}>
          <Text style={styles.verdict}>{result.verdict.toUpperCase()}</Text>
          <Text style={styles.reason}>{result.reason}</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, gap: 16 },
  heading: { fontSize: 22, fontWeight: "600" },
  input: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    textAlignVertical: "top",
  },
  button: {
    backgroundColor: "#0b6e4f",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: "white", fontWeight: "600", fontSize: 16 },
  result: { gap: 4, padding: 12, borderRadius: 8, backgroundColor: "#f1f5f4" },
  verdict: { fontSize: 18, fontWeight: "700" },
  reason: { color: "#444" },
});
