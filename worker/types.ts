export interface Env {
  DB: D1Database;
  SOURCES_JSON?: string;
  ADMIN_TOKEN?: string;
}
export interface Source { id:string; name:string; url:string; region?:string; carrier?:string; enabled?:boolean; }
