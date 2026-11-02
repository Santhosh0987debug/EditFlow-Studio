import type {
  TextDocumentDto,
  TextVersionDto,
  TextVersionSource,
  TextVersionSummaryDto,
} from "@editflow/shared";
import { AppError } from "../../lib/app-error";
import { prisma } from "../../lib/prisma";
import { getOwnedProject } from "../projects/project.service";
import type { SaveTextVersionInput } from "./text.schemas";

type TextDocumentRecord = {
  id: string;
  projectId: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
};

type TextVersionRecord = {
  id: string;
  version: number;
  title: string;
  content: string;
  source: TextVersionSource;
  createdAt: Date;
};

const documentSelect = {
  id: true,
  projectId: true,
  title: true,
  createdAt: true,
  updatedAt: true,
} as const;

const versionSelect = {
  id: true,
  version: true,
  title: true,
  content: true,
  source: true,
  createdAt: true,
} as const;

function toVersionDto(version: TextVersionRecord): TextVersionDto {
  return {
    id: version.id,
    version: version.version,
    title: version.title,
    content: version.content,
    source: version.source,
    characterCount: version.content.length,
    createdAt: version.createdAt.toISOString(),
  };
}

function toVersionSummary(
  version: TextVersionRecord,
): TextVersionSummaryDto {
  return {
    id: version.id,
    version: version.version,
    title: version.title,
    source: version.source,
    characterCount: version.content.length,
    createdAt: version.createdAt.toISOString(),
  };
}

function toDocumentDto(
  document: TextDocumentRecord,
  latestVersion: TextVersionRecord | null,
): TextDocumentDto {
  return {
    id: document.id,
    projectId: document.projectId,
    title: document.title,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
    versionCount: latestVersion?.version ?? 0,
    latestVersion: latestVersion ? toVersionDto(latestVersion) : null,
  };
}

export async function getTextDocument(
  ownerId: string,
  projectId: string,
): Promise<TextDocumentDto | null> {
  await getOwnedProject(ownerId, projectId);

  const document = await prisma.textDocument.findUnique({
    where: { projectId },
    select: documentSelect,
  });

  if (!document) {
    return null;
  }

  const latestVersion = await prisma.textVersion.findFirst({
    where: { documentId: document.id },
    orderBy: { version: "desc" },
    select: versionSelect,
  });

  return toDocumentDto(document, latestVersion);
}

export async function saveTextVersion(
  ownerId: string,
  projectId: string,
  input: SaveTextVersionInput,
): Promise<{ document: TextDocumentDto; version: TextVersionDto }> {
  await getOwnedProject(ownerId, projectId);

  const document = await prisma.textDocument.upsert({
    where: { projectId },
    update: { title: input.title },
    create: {
      projectId,
      title: input.title,
    },
    select: documentSelect,
  });

  const latestVersion = await prisma.textVersion.findFirst({
    where: { documentId: document.id },
    orderBy: { version: "desc" },
    select: { version: true },
  });

  const version = await prisma.textVersion.create({
    data: {
      documentId: document.id,
      version: (latestVersion?.version ?? 0) + 1,
      title: input.title,
      content: input.content,
      source: input.source,
    },
    select: versionSelect,
  });

  return {
    document: toDocumentDto(document, version),
    version: toVersionDto(version),
  };
}

export async function listTextVersions(
  ownerId: string,
  projectId: string,
): Promise<TextVersionSummaryDto[]> {
  await getOwnedProject(ownerId, projectId);

  const document = await prisma.textDocument.findUnique({
    where: { projectId },
    select: { id: true },
  });

  if (!document) {
    return [];
  }

  const versions = await prisma.textVersion.findMany({
    where: { documentId: document.id },
    orderBy: { version: "desc" },
    take: 100,
    select: versionSelect,
  });

  return versions.map(toVersionSummary);
}

export async function getTextVersion(
  ownerId: string,
  projectId: string,
  versionId: string,
): Promise<TextVersionDto> {
  await getOwnedProject(ownerId, projectId);

  const document = await prisma.textDocument.findUnique({
    where: { projectId },
    select: { id: true },
  });

  if (!document) {
    throw new AppError(404, "Version not found.");
  }

  const version = await prisma.textVersion.findFirst({
    where: {
      id: versionId,
      documentId: document.id,
    },
    select: versionSelect,
  });

  if (!version) {
    throw new AppError(404, "Version not found.");
  }

  return toVersionDto(version);
}
