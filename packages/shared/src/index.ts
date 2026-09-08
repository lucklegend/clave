// The package's public surface. Deep imports (`@clavehq/shared/schemas/auth`) resolve through
// the `exports` map in package.json; this barrel is for the common case.
export {
  INVALID_CREDENTIALS_MESSAGE,
  isEmailIdentifier,
  signInSchema,
  type SignInFailure,
  type SignInFields,
  type SignInInput,
  type SignInResult,
} from "./schemas/auth";
export { permissionKeySchema, PERMISSION_KEYS, type PermissionKey } from "./schemas/permissions";
export { readPublicEnv, type PublicEnv } from "./env";
export type { Database, Json } from "./types/database";
