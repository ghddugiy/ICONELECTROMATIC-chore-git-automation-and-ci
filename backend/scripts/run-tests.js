import { spawnSync } from "node:child_process";

function resolveTestDatabaseUrl() {
  const isGitHubActions = process.env.GITHUB_ACTIONS === "true";
  const databaseUrl = process.env.TEST_DATABASE_URL || (
    isGitHubActions ? process.env.DATABASE_URL : ""
  );

  if (!databaseUrl) {
    throw new Error(
      "Set TEST_DATABASE_URL to the local Docker test database before running backend tests."
    );
  }

  let url;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new Error("The test database URL is invalid.");
  }

  const expectedPort = isGitHubActions ? "5432" : "5433";
  const expectedDatabase = isGitHubActions
    ? "/icon_ci_test"
    : "/icon_electromatic_test";
  const isLoopback = ["localhost", "127.0.0.1"].includes(url.hostname);

  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !isLoopback ||
    url.port !== expectedPort ||
    url.pathname !== expectedDatabase
  ) {
    throw new Error(
      isGitHubActions
        ? "Backend tests only allow the isolated GitHub Actions test database."
        : "Backend tests only allow icon_electromatic_test on local port 5433."
    );
  }

  return databaseUrl;
}

let testDatabaseUrl;
try {
  testDatabaseUrl = resolveTestDatabaseUrl();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}

if (testDatabaseUrl) {
  const result = spawnSync(process.execPath, ["--test"], {
    env: {
      ...process.env,
      CI: "true",
      NODE_ENV: "test",
      TEST_DATABASE_URL: testDatabaseUrl,
    },
    stdio: "inherit",
  });

  if (result.error) {
    console.error("Could not start the backend test runner:", result.error.message);
    process.exitCode = 1;
  } else {
    process.exitCode = result.status ?? 1;
  }
}
