// The package's public surface. Deep imports (`@clavehq/shared/schemas/auth`) resolve through
// the `exports` map in package.json; this barrel is for the common case.
export {
  announcementDraftSchema,
  ANNOUNCEMENT_DELETE_FAILED_MESSAGE,
  ANNOUNCEMENT_SAVE_FAILED_MESSAGE,
  ATTACHMENTS_REFUSED_MESSAGE,
  ATTACHMENTS_TOO_LARGE_MESSAGE,
  ATTACHMENT_LIMITS,
  ATTACHMENT_REMOVE_FAILED_MESSAGE,
  ATTACHMENT_TOO_LARGE_MESSAGE,
  ATTACHMENT_TYPES,
  findAttachmentTypeByExtension,
  findAttachmentTypeByMimeType,
  isImageFormat,
  SCHEDULE_MUST_BE_FUTURE,
  SCHEDULE_NEEDS_A_TIME,
  TOO_MANY_ATTACHMENTS_MESSAGE,
  type AnnouncementDraftFields,
  type AnnouncementDraftInput,
  type AnnouncementIntent,
  type AttachmentError,
  type AttachmentFormat,
  type AttachmentType,
  type ImageAttachmentFormat,
  type SaveAnnouncementFailure,
  type SaveAnnouncementResult,
} from "./schemas/announcements";
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
