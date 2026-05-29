import "@testing-library/react-native/extend-expect";
import { setupSpecCoverage } from "@platform/spec-test/jest";

// Component layer: render screens with React Native Testing Library. Records
// [ID]-named tests as category "ui".
setupSpecCoverage({ category: "ui" });
