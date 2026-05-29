import { readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import { SpecFile } from "./schema.js";
import type { SpecFile as SpecFileT } from "./schema.js";

export interface ParseResult {
  spec: SpecFileT;
  path: string;
}

export class SpecParseError extends Error {
  constructor(
    message: string,
    public readonly path: string,
    public readonly issues?: unknown,
  ) {
    super(message);
    this.name = "SpecParseError";
  }
}

export function parseSpec(path: string): ParseResult {
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch (err) {
    throw new SpecParseError(
      `Failed to read spec file: ${(err as Error).message}`,
      path,
    );
  }

  let doc: unknown;
  try {
    doc = parseYaml(raw);
  } catch (err) {
    throw new SpecParseError(
      `Invalid YAML in spec file: ${(err as Error).message}`,
      path,
    );
  }

  const result = SpecFile.safeParse(doc);
  if (!result.success) {
    throw new SpecParseError(
      `Spec schema validation failed for ${path}`,
      path,
      result.error.issues,
    );
  }

  return { spec: result.data, path };
}

export function getRequirementIds(spec: SpecFileT): Set<string> {
  return new Set(spec.requirements.map((r) => r.id));
}
