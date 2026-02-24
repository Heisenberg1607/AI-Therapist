"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSessionById = exports.createSession = void 0;
const prismaClient_1 = require("../prisma/prismaClient");
const createSession = async (userId) => {
    const sessionData = {};
    if (userId) {
        sessionData.userId = userId;
    }
    return await prismaClient_1.prisma.session.create({
        data: sessionData,
    });
};
exports.createSession = createSession;
const getSessionById = async (sessionId) => {
    return await prismaClient_1.prisma.session.findUnique({
        where: { id: sessionId },
        include: { messages: true },
    });
};
exports.getSessionById = getSessionById;
