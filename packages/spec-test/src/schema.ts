import { z } from "zod";

export const RequirementCategory = z.enum([
  "functional",
  "ui",
  "security",
  "data",
  "a11y",
]);

export const RequirementSeverity = z.enum([
  "critical",
  "high",
  "medium",
  "low",
]);

// The verification level that must prove a requirement. Replaces the implicit
// "category equals layer" heuristic with an explicit, auditable statement.
// `native` and `manual` are proven by a signed verification artifact, not an
// automated test result (see docs/adr/0001-testing-architecture.md).
export const VerifyLevel = z.enum([
  "unit",
  "component",
  "integration",
  "contract",
  "e2e",
  "native",
  "manual",
]);

export const Platform = z.enum(["ios", "android"]);

const requirementIdPattern = /^[A-Z][A-Z0-9]*(-[A-Z][A-Z0-9]*)+-\d{3,}$/;

export const Requirement = z
  .object({
    id: z
      .string()
      .regex(
        requirementIdPattern,
        "id must look like APP-DOMAIN-001 (uppercase letters/digits, hyphens, 3+ digit suffix)",
      ),
    title: z.string().min(5).max(200),
    category: RequirementCategory,
    severity: RequirementSeverity,
    given: z.string().min(3),
    when: z.string().min(3),
    then: z.string().min(3),
    // Optional during migration. When set, the gate enforces proof at this
    // level. `native`/`manual` are satisfied by a verification artifact, not a
    // recorded test. When unset, the requirement falls back to legacy behavior
    // (covered by any passing recorded test).
    verify: VerifyLevel.optional(),
    // Required result per platform for e2e/native requirements that differ by
    // platform. Empty means platform-agnostic (a single artifact / test).
    platforms: z.array(Platform).default([]),
    tags: z.array(z.string().min(1)).default([]),
    depends_on: z.array(z.string().regex(requirementIdPattern)).default([]),
    notes: z.string().optional(),
  })
  .strict();

export const SpecFile = z
  .object({
    app: z.string().min(1).max(64),
    version: z.number().int().positive(),
    requirements: z.array(Requirement).min(1),
  })
  .strict()
  .superRefine((spec, ctx) => {
    const seen = new Set<string>();
    spec.requirements.forEach((req, i) => {
      if (seen.has(req.id)) {
        ctx.addIssue({
          code: "custom",
          path: ["requirements", i, "id"],
          message: `duplicate requirement id: ${req.id}`,
        });
      }
      seen.add(req.id);
    });
    const ids = new Set(spec.requirements.map((r) => r.id));
    spec.requirements.forEach((req, i) => {
      req.depends_on.forEach((dep, j) => {
        if (!ids.has(dep)) {
          ctx.addIssue({
            code: "custom",
            path: ["requirements", i, "depends_on", j],
            message: `depends_on references unknown id: ${dep}`,
          });
        }
      });
    });
  });

export type Requirement = z.infer<typeof Requirement>;
export type SpecFile = z.infer<typeof SpecFile>;
export type RequirementCategory = z.infer<typeof RequirementCategory>;
export type RequirementSeverity = z.infer<typeof RequirementSeverity>;
export type VerifyLevel = z.infer<typeof VerifyLevel>;
export type Platform = z.infer<typeof Platform>;
