import { setupSpecCoverage } from "@platform/spec-test/jest";

// Unit layer: pure logic. Records [ID]-named tests as category "data".
setupSpecCoverage({ category: "data" });
