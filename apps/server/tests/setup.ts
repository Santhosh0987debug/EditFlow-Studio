process.env.NODE_ENV = "test";
process.env.DATABASE_URL =
  "postgresql://test:test@localhost:5432/editflow_studio_test?schema=public";
process.env.JWT_SECRET =
  "test-only-secret-that-is-longer-than-thirty-two-characters";

// Keep AI tests deterministic even when the developer's .env configures a
// provider for the running app.
delete process.env.AI_PROVIDER;
delete process.env.AI_API_KEY;
delete process.env.AI_MODEL;
delete process.env.AI_BASE_URL;
