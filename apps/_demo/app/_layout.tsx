import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { DeviceFrame } from "../components/DeviceFrame";

export default function RootLayout() {
  return (
    <DeviceFrame>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerTitle: "mobile-platform demo" }}>
        <Stack.Screen name="index" options={{ title: "Check & Report" }} />
      </Stack>
    </DeviceFrame>
  );
}
