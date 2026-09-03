import { OpenAIEmbeddings } from "@langchain/openai";
import { Pinecone } from "@pinecone-database/pinecone";
import { createHash } from "node:crypto";

const embeddings = new OpenAIEmbeddings({model:"text-embedding-3-small"});

const pc = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

const UPSERT_BATCH_SIZE = 100;
const DEFAULT_TOP_K = 5;

function repoToNamespace(repo) {
  return repo.replace("/", "-");
}

function getIndex(namespace) {
  const indexName = process.env.PINECONE_INDEX || "repochat";
  return pc.index({ name: indexName }).namespace(namespace);
}

function normalizeDocuments(documents) {
  return documents
    .map((doc) => ({
      pageContent: typeof doc.pageContent === "string" ? doc.pageContent : "",
      metadata: doc.metadata ?? {},
    }))
    .filter((doc) => doc.pageContent.trim().length > 0);
}

function buildRecordId(repo, metadata, content) {
  return createHash("sha256")
    .update(`${repo}:${metadata.path ?? ""}:${content}`)
    .digest("hex");
}

export async function saveChunks(repo, documents) {
  const chunks = normalizeDocuments(documents);

  if (!chunks.length) {
    return { saved: false, chunkCount: 0 };
  }

  const namespace = repoToNamespace(repo);
  const index = getIndex(namespace);
  const texts = chunks.map((doc) => doc.pageContent);
  const vectors = await embeddings.embedDocuments(texts);

  const records = chunks.map((doc, i) => ({
    id: buildRecordId(repo, doc.metadata, doc.pageContent),
    values: vectors[i],
    metadata: {
      text: doc.pageContent,
      path: doc.metadata.path,
      repo: doc.metadata.repo ?? repo,
    },
  }));

  for (let i = 0; i < records.length; i += UPSERT_BATCH_SIZE) {
    await index.upsert({
      records: records.slice(i, i + UPSERT_BATCH_SIZE),
    });
  }

  return { saved: true, chunkCount: chunks.length };
}

function toSearchDocument(match) {
  const metadata = match.metadata ?? {};

  return {
    pageContent: metadata.text ?? "",
    metadata: {
      path: metadata.path,
      repo: metadata.repo,
    },
    score: match.score,
  };
}

export async function search(repo, question, topK = DEFAULT_TOP_K) {
  const namespace = repoToNamespace(repo);
  const index = getIndex(namespace);
  const vector = await embeddings.embedQuery(question);

  const response = await index.query({
    vector,
    topK,
    includeMetadata: true,
  });

  return (response.matches ?? [])
    .map(toSearchDocument)
    .filter((doc) => doc.pageContent.trim().length > 0);
}

