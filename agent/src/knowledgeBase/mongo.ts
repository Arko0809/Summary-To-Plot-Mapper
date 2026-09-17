import { Collection, MongoClient } from "mongodb";
import { env } from "../shared/env";

export type PolicyChunk = {
  companyName: string;
  companyKey: string;
  documentName: string;
  chunkIndex: number;
  content: string;
  createdAt: Date;
};

export type PolicyDocument = {
  companyName: string;
  companyKey: string;
  documentName: string;
  pdf: Buffer;
  contentHash: string;
  updatedAt: Date;
};

let client: MongoClient | undefined;
let collectionPromise: Promise<Collection<PolicyChunk>> | undefined;
let documentsPromise: Promise<Collection<PolicyDocument>> | undefined;

/**
 * Normalizes the incoming company name into the key used when storing and querying policy chunks.
 */
export function companyKey(companyName: string) {
  return companyName.trim().toLocaleLowerCase();
}

/**
 * Opens the policy chunk collection and ensures the MongoDB text index is available for search.
 */
export function getPolicyChunks() {
  if (!env.MONGODB_URI) {
    throw new Error("MONGODB_URI is not configured. Add your MongoDB Atlas connection string to agent/.env.");
  }

  if (!collectionPromise) {
    client = new MongoClient(env.MONGODB_URI);
    collectionPromise = client.connect().then(async () => {
      const collection = client!.db(env.MONGODB_DB_NAME).collection<PolicyChunk>("policy_chunks");
      await collection.createIndex({ companyKey: 1, documentName: 1, chunkIndex: 1 });
      await collection.createIndex({ content: "text" });
      return collection;
    });
  }

  return collectionPromise;
}

/**
 * Opens the policy document collection used to store PDFs and their content hashes for change detection.
 */
export function getPolicyDocuments() {
  if (!env.MONGODB_URI) {
    throw new Error("MONGODB_URI is not configured. Add your MongoDB Atlas connection string to agent/.env.");
  }
  if (!documentsPromise) {
    client ??= new MongoClient(env.MONGODB_URI);
    documentsPromise = client.connect().then(async () => {
      const collection = client!.db(env.MONGODB_DB_NAME).collection<PolicyDocument>("policy_documents");
      await collection.createIndex({ companyKey: 1, documentName: 1 }, { unique: true });
      return collection;
    });
  }
  return documentsPromise;
}
