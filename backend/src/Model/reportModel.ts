import { prisma } from "../prisma/prismaClient";
import { ReportType } from "@prisma/client";

export interface CreateReportInput {
  id?: string;
  userId: string;
  type: ReportType;
  title: string;
  summary?: string | null;
  mostCommonIssues?: string[];
  filePath: string;
  fileType: string;
}

export const createReport = async (data: CreateReportInput) => {
  return prisma.report.create({
    data: {
      ...(data.id ? { id: data.id } : {}),
      userId: data.userId,
      type: data.type,
      title: data.title,
      summary: data.summary ?? null,
      mostCommonIssues: data.mostCommonIssues ?? [],
      filePath: data.filePath,
      fileType: data.fileType,
    },
  });
};

// All reports for a user, newest first.
export const getReportsByUser = async (userId: string) => {
  return prisma.report.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
};

// A single report, scoped to its owner (null if not found / not owned).
export const getReportById = async (id: string, userId: string) => {
  return prisma.report.findFirst({ where: { id, userId } });
};
