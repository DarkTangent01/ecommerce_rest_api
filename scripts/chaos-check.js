const checks = [
  "Kill a notification worker and verify queued jobs remain durable.",
  "Force payment webhook replay and verify idempotent processing.",
  "Simulate checkout lock contention and verify one order is created.",
  "Disable cache backend and verify API falls back to database.",
];

console.log(JSON.stringify({ chaosPlan: checks }, null, 2));
