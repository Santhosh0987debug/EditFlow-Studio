import { app } from "./app";
import { env } from "./config/env";

app.listen(env.port, () => {
  console.log(`EditFlow Studio API listening on http://localhost:${env.port}`);
});
