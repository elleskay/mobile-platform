import { Platform, StyleSheet, View, type ViewStyle } from "react-native";

// On web the app is served full-window, which stretches the phone UI across the
// whole browser. DeviceFrame constrains it to a centered phone-shaped column on a
// neutral page so the web build (the clickable demo) reads like the mobile app.
// No-op on native. Copy this into each app and wrap the root layout with it.
export function DeviceFrame({ children }: { children: React.ReactNode }) {
  if (Platform.OS !== "web") return <>{children}</>;
  return (
    <View style={styles.page}>
      <View style={[styles.column, webShadow]}>{children}</View>
    </View>
  );
}

// boxShadow is a valid react-native-web style but not in the RN types.
const webShadow = { boxShadow: "0 0 48px rgba(15,23,42,0.14)" } as unknown as ViewStyle;

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#dbe3ee",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  // ~412x915 matches a typical phone aspect; clamps to the viewport on smaller screens.
  column: {
    width: 412,
    height: 915,
    maxWidth: "100%",
    maxHeight: "100%",
    backgroundColor: "#ffffff",
    borderRadius: 28,
    overflow: "hidden",
  },
});
