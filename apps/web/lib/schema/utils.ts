/**
 * Schema utilities — safe serialization and injection helpers.
 */

/**
 * Serialize a single schema object to JSON-LD string.
 * Safe for use in dangerouslySetInnerHTML.
 *
 * @param schema Any schema object
 * @returns JSON string safe for <script type="application/ld+json">
 */
export function serializeSchema(schema: unknown): string {
  try {
    return JSON.stringify(schema);
  } catch (error) {
    console.error('Failed to serialize schema:', error, schema);
    return '{}';
  }
}

/**
 * Serialize multiple schemas into a single JSON-LD array.
 * When multiple schemas need to be in one <script> tag.
 *
 * @param schemas Array of schema objects
 * @returns JSON string with @graph array
 */
export function serializeSchemas(schemas: unknown[]): string {
  try {
    if (schemas.length === 0) return '{}';
    if (schemas.length === 1) return JSON.stringify(schemas[0]);
    // Multiple schemas: wrap in @graph
    return JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': schemas,
    });
  } catch (error) {
    console.error('Failed to serialize schemas:', error);
    return '{}';
  }
}

/**
 * Validate schema has required fields.
 * Useful for development/testing.
 *
 * @param schema Schema to validate
 * @param requiredFields Fields that must exist
 * @returns true if valid
 */
export function validateSchema(
  schema: Record<string, unknown>,
  requiredFields: string[] = ['@context', '@type']
): boolean {
  return requiredFields.every((field) => field in schema && schema[field] !== undefined);
}

/**
 * Remove null/undefined values from schema for cleaner JSON output.
 * Recursively cleans nested objects.
 *
 * @param obj Object to clean
 * @returns Cleaned object
 */
export function cleanSchema(obj: unknown): unknown {
  if (obj === null || obj === undefined) return undefined;

  if (Array.isArray(obj)) {
    return obj
      .map((item) => cleanSchema(item))
      .filter((item) => item !== undefined && item !== null);
  }

  if (typeof obj === 'object' && obj !== null) {
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const cleanedValue = cleanSchema(value);
      if (cleanedValue !== undefined && cleanedValue !== null) {
        cleaned[key] = cleanedValue;
      }
    }
    return Object.keys(cleaned).length > 0 ? cleaned : undefined;
  }

  return obj;
}
