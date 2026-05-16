const baseUrl = process.env.LOAD_TEST_URL || "http://127.0.0.1:5000/api";
const concurrency = Number(process.env.LOAD_TEST_CONCURRENCY || 10);
const requests = Number(process.env.LOAD_TEST_REQUESTS || 100);

const run = async () => {
  const started = Date.now();
  let ok = 0;
  let failed = 0;
  await Promise.all(
    Array.from({ length: concurrency }, async (_, worker) => {
      for (let i = worker; i < requests; i += concurrency) {
        const response = await fetch(`${baseUrl}/health`).catch(() => null);
        if (response?.ok) ok += 1;
        else failed += 1;
      }
    })
  );
  console.log(JSON.stringify({ requests, ok, failed, durationMs: Date.now() - started }));
};

run();
