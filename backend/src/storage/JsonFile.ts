import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { ZodError, type ZodType } from 'zod';
import { ManifestValidationError, type FieldIssue } from '../utils/errors';

/**
 * Validated JSON read/write at the filesystem boundary (FR-010, Constitution
 * XIV). Every write is validated before it touches disk; every read is
 * validated after parsing. Validation failures surface as a
 * {@link ManifestValidationError} carrying per-field issues for the API layer.
 */

/** Flattens a `ZodError` into the `{ path, message }` issue shape. */
function toFieldIssues(error: ZodError): FieldIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.length > 0 ? issue.path.join('.') : '(root)',
    message: issue.message,
  }));
}

/**
 * Validates `data` against `schema`, then writes it as pretty-printed JSON
 * (2-space indent, trailing newline). Parent directories are created if
 * missing. Throws {@link ManifestValidationError} if the data is invalid.
 */
export async function writeJson<T>(path: string, schema: ZodType<T>, data: unknown): Promise<T> {
  let validated: T;
  try {
    validated = schema.parse(data);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ManifestValidationError(
        `Refusing to write malformed JSON to '${path}'`,
        toFieldIssues(error),
      );
    }
    throw error;
  }
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(validated, null, 2)}\n`, 'utf8');
  return validated;
}

/**
 * Reads and parses JSON from `path`, then validates it against `schema`.
 * Throws {@link ManifestValidationError} when the file is not valid JSON or
 * fails schema validation. Filesystem errors (e.g. `ENOENT`) propagate to the
 * caller, which is responsible for distinguishing "not found" from "malformed".
 */
export async function readJson<T>(path: string, schema: ZodType<T>): Promise<T> {
  const raw = await readFile(path, 'utf8');

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ManifestValidationError(`File '${path}' is not valid JSON`, [
      { path: '(root)', message: 'File contents are not valid JSON' },
    ]);
  }

  try {
    return schema.parse(parsed);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ManifestValidationError(
        `File '${path}' failed schema validation`,
        toFieldIssues(error),
      );
    }
    throw error;
  }
}
