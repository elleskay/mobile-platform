import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function RootLayout() {
  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerTitle: "ScamShield Demo" }}>
        <Stack.Screen name="index" options={{ title: "Check & Report" }} />
      </Stack>
    </>
  );
}
