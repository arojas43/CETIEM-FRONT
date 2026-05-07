import { Queue } from 'bullmq';

const userId = 'cmo0mbf0r0002nu544slvvdxg';
const docIds = [
  'cmoufo3p10001lf0w21x6hw55',
  'cmoufo3r90005lf0wbrwwifbw',
  'cmoufo3sb0009lf0wrmnzon3s',
  'cmoufo3tc000dlf0wu746hisv',
];

const indexQueue = new Queue('document-processing', {
  connection: { host: 'localhost', port: 6381 }
});

for (const docId of docIds) {
  const job = await indexQueue.add('document-processing', {
    documentId: docId,
    userId,
    type: 'index',
  });
  console.log(`Enqueued index job for ${docId} → job ${job.id}`);
}

await indexQueue.close();
console.log('Done');
