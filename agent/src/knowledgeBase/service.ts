import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { DOMMatrix, DOMPoint, DOMRect, ImageData, Path2D } from "@napi-rs/canvas";
import { getChatModel } from "../shared/models";
import { env } from "../shared/env";
import { SearchAnswer, SearchInput } from "../utils/schemas";
import { companyKey, getPolicyChunks, getPolicyDocuments, PolicyChunk } from "./mongo";

const inFlightIngestions = new Map<string, Promise<void>>();
let pdfParseModule: Promise<typeof import("pdf-parse")> | undefined;

/**
 * PDF.js expects browser geometry globals. Node does not provide them, so install
 * the native canvas equivalents before loading pdf-parse (the import must stay lazy).
 */
/**
 * Extracts readable text from a PDF buffer so the knowledge base can create searchable policy chunks.
 */
async function extractPdfText(pdf: Buffer) {
  const globals = globalThis as Record<string, unknown>;
  if (!globals.DOMMatrix) Object.assign(globals, { DOMMatrix });
  if (!globals.DOMPoint) Object.assign(globals, { DOMPoint });
  if (!globals.DOMRect) Object.assign(globals, { DOMRect });
  if (!globals.ImageData) Object.assign(globals, { ImageData });
  if (!globals.Path2D) Object.assign(globals, { Path2D });

  pdfParseModule ??= import("pdf-parse");
  const { PDFParse } = await pdfParseModule;
  const parser = new PDFParse({ data: pdf });
  try {
    return (await parser.getText()).text;
  } finally {
    await parser.destroy();
  }
}

/**
 * Splits a policy document into overlapping text chunks that stay within a manageable token window.
 */
export function splitIntoChunks(text: string, chunkSize = 1_200, overlap = 180) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  const chunks: string[] = [];
  for (let start = 0; start < cleaned.length; start += chunkSize - overlap) {
    const candidate = cleaned.slice(start, start + chunkSize);
    const end = candidate.lastIndexOf(". ");
    chunks.push(candidate.slice(0, end > chunkSize * 0.55 ? end + 1 : candidate.length).trim());
    if (start + chunkSize >= cleaned.length) break;
  }
  return chunks.filter((chunk) => chunk.length >= 40);
}

/**
 * Persists a newly ingested company PDF as both chunked text and the original document blob.
 */
async function savePolicyDocument(companyName: string, documentName: string, text: string, pdf: Buffer, contentHash: string) {
  const chunks = splitIntoChunks(text);
  if (!chunks.length) throw new Error("The PDF did not contain readable text.");

  const collection = await getPolicyChunks();
  const documents = await getPolicyDocuments();
  const key = companyKey(companyName);
  // A company has one authoritative folder policy; remove old chunks if the file was replaced or renamed.
  await collection.deleteMany({ companyKey: key });
  await collection.insertMany(chunks.map((content, chunkIndex) => ({
    companyName: companyName.trim(), companyKey: key, documentName, chunkIndex, content, createdAt: new Date(),
  })));
  await documents.deleteMany({ companyKey: key });
  await documents.updateOne(
    { companyKey: key, documentName },
    { $set: { companyName: companyName.trim(), companyKey: key, documentName, pdf, contentHash, updatedAt: new Date() } },
    { upsert: true },
  );
  return chunks.length;
}

/**
 * Converts the company name into the exact PDF filename base expected inside the document folder.
 */
function normalizedFileBase(companyName: string) {
  return companyName.trim().toLocaleLowerCase();
}

/**
 * Finds the authoritative PDF for a company and validates that there is exactly one matching document.
 */
async function findCompanyPolicyFile(companyName: string) {
  const directory = env.KB_DOCUMENTS_DIR
    ? resolve(env.KB_DOCUMENTS_DIR)
    : resolve(process.cwd(), "src", "docs");
  let files: string[];
  try {
    files = await readdir(directory);
  } catch {
    throw new Error(`Policy documents folder is unavailable: ${directory}`);
  }

  const expected = normalizedFileBase(companyName);
  const matches = files.filter((file) => {
    const dot = file.lastIndexOf(".");
    return dot > 0 && file.slice(dot + 1).toLocaleLowerCase() === "pdf" && file.slice(0, dot).trim().toLocaleLowerCase() === expected;
  });
  if (matches.length === 0) {
    throw new Error(`No policy PDF exists for company "${companyName}". Expected ${expected}.pdf in ${directory}.`);
  }
  if (matches.length > 1) {
    throw new Error(`Multiple policy PDFs match company "${companyName}". Keep exactly one ${expected}.pdf file.`);
  }
  return { directory, fileName: matches[0], path: resolve(directory, matches[0]) };
}

/**
 * Ensures a company policy is ingested once per active request cycle, avoiding duplicate PDF parsing work.
 */
async function ensureCompanyPolicyIngested(companyName: string) {
  const key = companyKey(companyName);
  const existingWork = inFlightIngestions.get(key);
  if (existingWork) return existingWork;

  const work = (async () => {
    const policyFile = await findCompanyPolicyFile(companyName);
    const pdf = await readFile(policyFile.path);
    const contentHash = createHash("sha256").update(pdf).digest("hex");
    const documents = await getPolicyDocuments();
    const current = await documents.findOne({ companyKey: key, documentName: policyFile.fileName }, { projection: { contentHash: 1 } });
    if (current?.contentHash === contentHash) return;

    const text = await extractPdfText(pdf);
    await savePolicyDocument(companyName, policyFile.fileName, text, pdf, contentHash);
  })().finally(() => inFlightIngestions.delete(key));
  inFlightIngestions.set(key, work);
  return work;
}

/**
 * Searches the company policy knowledge base for the most relevant excerpts and answers only from that policy source.
 */
export async function runKnowledgeBaseSearch(input: SearchInput): Promise<SearchAnswer> {
  const question = input.q.trim();

  await ensureCompanyPolicyIngested(input.companyName);
  const collection = await getPolicyChunks();
  const companyFilter = { companyKey: companyKey(input.companyName) };
  let chunks: PolicyChunk[] = [];
  try {
    chunks = await collection.find({ ...companyFilter, $text: { $search: question } }, { projection: { score: { $meta: "textScore" } } })
      .sort({ score: { $meta: "textScore" } }).limit(5).toArray();
  } catch {
    // Allows the endpoint to work while Atlas is still creating the text index.
  }
  if (!chunks.length) {
    const terms: string[] = question
      .toLowerCase()
      .split(/\W+/)
      .filter((term: string) => term.length > 2)
      .slice(0, 8);
    const matches = terms.length
      ? { $or: terms.map((term: string) => ({ content: { $regex: term, $options: "i" } })) }
      : {};
    chunks = await collection.find({ ...companyFilter, ...matches }).limit(5).toArray();
  }
  if (!chunks.length) {
    return { answer: `I couldn't find relevant policy content for ${input.companyName}.`, sources: [] };
  }

  const context = chunks.map((chunk, index) => `[${index + 1}] ${chunk.content}`).join("\n\n");
  const response = await getChatModel({ temperature: 0.1 }).invoke([
    new SystemMessage("Answer only from the supplied company policy excerpts. If the answer is not in them, say so. Do not use outside knowledge. Cite excerpt numbers like [1] in the answer when possible."),
    new HumanMessage(`Question: ${question}\n\nPolicy excerpts:\n${context}`),
  ]);
  const answer = (typeof response.content === "string" ? response.content : String(response.content)).trim();
  return {
    answer,
    sources: chunks.map((chunk) => `${chunk.documentName} — chunk ${chunk.chunkIndex + 1}`),
  };
}
