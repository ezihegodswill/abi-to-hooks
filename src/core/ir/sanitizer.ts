/**
 * TypeScript reserved words that cannot be used as unescaped parameter names or identifiers.
 */
const TS_RESERVED_WORDS = new Set([
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'debugger',
  'default',
  'delete',
  'do',
  'else',
  'enum',
  'export',
  'extends',
  'false',
  'finally',
  'for',
  'function',
  'if',
  'import',
  'in',
  'instanceof',
  'interface',
  'let',
  'new',
  'null',
  'package',
  'private',
  'protected',
  'public',
  'return',
  'super',
  'switch',
  'this',
  'throw',
  'true',
  'try',
  'type',
  'typeof',
  'var',
  'void',
  'while',
  'with',
  'yield',
  'await',
  'async',
  'any',
  'boolean',
  'number',
  'string',
  'symbol',
  'unknown',
  'never',
  'object',
  'bigint',
]);

/**
 * Sanitizes an identifier name into a valid JavaScript identifier.
 * Removes special characters, converts spaces/hyphens to camelCase or underscores.
 */
export function sanitizeIdentifier(name: string): string {
  if (!name) return 'arg';

  // Clean invalid identifier characters
  let clean = name.replace(/[^a-zA-Z0-9_$]/g, '_');

  // Ensure identifier does not start with a digit
  if (/^[0-9]/.test(clean)) {
    clean = `_${clean}`;
  }

  return clean;
}

/**
 * Ensures a parameter name does not conflict with TypeScript reserved words.
 * If a conflict exists, prepends an underscore (e.g. `type` -> `_type`).
 */
export function sanitizeParamName(name: string, index: number): string {
  if (!name || name.trim() === '') {
    return `arg${index}`;
  }

  const clean = sanitizeIdentifier(name);
  if (TS_RESERVED_WORDS.has(clean)) {
    return `_${clean}`;
  }

  return clean;
}

/**
 * Converts a raw EVM type string into a capitalized camelCase string suitable for overload resolution suffixes.
 * Example: `address[]` -> `AddressArray`, `uint256` -> `Uint256`, `tuple` -> `Tuple`
 */
export function typeToSuffix(evmType: string): string {
  let clean = evmType.trim();

  const isArray = clean.endsWith('[]');
  if (isArray) {
    clean = clean.slice(0, -2);
  }

  // Capitalize first character
  clean = clean.charAt(0).toUpperCase() + clean.slice(1);

  // Clean special characters
  clean = clean.replace(/[^a-zA-Z0-9]/g, '');

  return isArray ? `${clean}Array` : clean;
}

/**
 * Capitalizes the first letter of a string.
 */
export function capitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Converts a string to camelCase.
 */
export function toCamelCase(str: string): string {
  const clean = sanitizeIdentifier(str);
  return clean.charAt(0).toLowerCase() + clean.slice(1);
}
