import { Queue } from 'bullmq';

const queues = ['document-processing', 'ai-analysis', 'report-generation'];
const connection = { host: 'localhost', port: 6381 };

for (const name of queues) {
  const q = new Queue(name, { connection });
  await q.drain();  // remove waiting
  await q.clean(0, 100, 'failed');  // remove failed
  await q.clean(0, 100, 'completed');
  const counts = await q.getJobCounts();
  console.log(`[${name}] after drain:`, counts);
  await q.close();
}
console.log('Done');
