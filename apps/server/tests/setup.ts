process.env.NODE_ENV = "test";
process.env.DATABASE_URL =
  "postgresql://test:test@localhost:5432/editflow_studio_test?schema=public";
process.env.JWT_SECRET =
  "test-only-secret-that-is-longer-than-thirty-two-characters";
