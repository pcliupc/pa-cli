export type CliKnowledgeType = "md" | "csv";
export type ApiKnowledgeType = "doc" | "csv";
export type KnowledgeApiDocumentType = ApiKnowledgeType | "page" | "file";
export type KnowledgeDocumentStatus = "published" | "archived";

export type KnowledgeTextInput = {
  type: CliKnowledgeType;
  apiType: ApiKnowledgeType;
  content: string;
  title: string;
};

export type KnowledgeDocument = {
  id: string;
  title: string;
  type: KnowledgeApiDocumentType;
  status: KnowledgeDocumentStatus;
  content: string;
  summary: string | null;
  spaceId: string | null;
  folderId: string | null;
  createdById: string | null;
  updatedById: string | null;
  currentRevisionId?: string | null;
  revisionNumber?: number;
  source?: {
    sessionId: string | null;
    sessionTitle: string | null;
    stageId: string | null;
    stageLabel: string | null;
    artifactId: string | null;
    liveArtifactId: string | null;
    sessionAvailable: boolean;
    liveArtifactAvailable: boolean;
  };
  file?: {
    id: string;
    originalName: string;
    mediaType: string;
    sizeBytes: string;
    checksumSha256: string;
  } | null;
  createdAt: string;
  updatedAt: string;
};

export type KnowledgeDocumentResponse = {
  document: KnowledgeDocument;
  capabilities: {
    viewHistory: boolean;
    restoreRevision: boolean;
  };
};

export type KnowledgeListResponse = {
  items: KnowledgeDocument[];
  total: number;
  limit: number;
  offset: number;
};

export type KnowledgeCreateResponse = {
  document: KnowledgeDocument;
  alreadyExists: boolean;
};

export type KnowledgeFolder = {
  id: string;
  name: string;
  parentId: string | null;
};

export type KnowledgeFolderResponse = {
  folder: KnowledgeFolder;
};

export type KnowledgeFolderListResponse = {
  folders: KnowledgeFolder[];
};
