"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMessagesBySession = exports.createMessage = void 0;
const prismaClient_1 = require("../prisma/prismaClient");
const createMessage = async (sessionId, sender, content) => {
    return await prismaClient_1.prisma.message.create({
        data: {
            sessionId,
            sender,
            content,
        },
    });
};
exports.createMessage = createMessage;
const getMessagesBySession = async (sessionId) => {
    return await prismaClient_1.prisma.message.findMany({
        where: { sessionId },
        orderBy: { createdAt: "asc" },
    });
};
exports.getMessagesBySession = getMessagesBySession;
