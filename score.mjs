import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

function indexGroups(groups) {
  if (!Array.isArray(groups) || groups.length === 0) {
    throw new Error('Each partition must contain at least one group.');
  }

  const index = new Map();
  for (const group of groups) {
    if (!Array.isArray(group) || group.length === 0) {
      throw new Error('Each group must contain at least one document.');
    }

    for (const document of group) {
      if (typeof document !== 'string' || !document || index.has(document)) {
        throw new Error('Document IDs must be unique non-empty strings in each partition.');
      }
      index.set(document, group);
    }
  }
  return index;
}

export function scorePartition(reference, prediction) {
  const referenceIndex = indexGroups(reference);
  const predictedIndex = indexGroups(prediction);
  if (referenceIndex.size !== predictedIndex.size ||
      [...referenceIndex.keys()].some(document => !predictedIndex.has(document))) {
    throw new Error('Both partitions must cover the same documents.');
  }

  let precision = 0;
  let recall = 0;
  let exactPartition = true;
  for (const [document, referenceGroup] of referenceIndex) {
    const predictedGroup = predictedIndex.get(document);
    const overlap = referenceGroup.filter(member => predictedIndex.get(member) === predictedGroup).length;
    precision += overlap / predictedGroup.length;
    recall += overlap / referenceGroup.length;
    exactPartition &&= overlap === referenceGroup.length && overlap === predictedGroup.length;
  }
  precision /= referenceIndex.size;
  recall /= referenceIndex.size;

  return {
    referenceGroupCount: reference.length,
    predictedGroupCount: prediction.length,
    correctGroupCount: reference.length === prediction.length,
    exactPartition,
    bCubedPrecision: precision,
    bCubedRecall: recall,
    bCubedF1: 2 * precision * recall / (precision + recall),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (process.argv.length !== 3) throw new Error('Usage: node score.mjs <input.json>');
    const { reference, prediction } = JSON.parse(readFileSync(process.argv[2], 'utf8'));
    console.log(JSON.stringify(scorePartition(reference, prediction), null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
