/**
 * Module-local types. Define your domain row types here. They should mirror the
 * module's own table(s) added in a migration.
 */
export interface TemplateRecord {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}
