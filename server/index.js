// Entry point: starts the STEMulate Academy API. All routes live in app.js so
// the tests can import the app without opening a port.
import app from "./app.js";

// Log instead of crashing if a promise rejection ever slips past a handler.
process.on("unhandledRejection", (e) => console.error(e));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`STEMulate Academy API running on http://localhost:${PORT}`);
});
