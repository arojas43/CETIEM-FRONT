import { Queue } from 'bullmq';

const userId = 'cmo0mbf0r0002nu544slvvdxg';
const docIds = [
  'cmoufo3p10001lf0w21x6hw55',  // Constancia
  'cmoufo3r90005lf0wbrwwifbw',  // Constitutiva
  'cmoufo3sb0009lf0wrmnzon3s',  // Estado de cuenta
  'cmoufo3tc000dlf0wu746hisv',  // OpinionCumplimiento
];

const aiQueue = new Queue('ai-analysis', {
  connection: {
    host: 'localhost',
    port: 6381,
    password: undefined,
  }
});

for (const docId of docIds) {
  const job = await aiQueue.add('ai-analysis', {
    documentId: docId,
    userId,
    analysisType: 'extraction',
  });
  console.log(`Enqueued ${docId} → job ${job.id}`);
}

await aiQueue.close();
console.log('Done');
