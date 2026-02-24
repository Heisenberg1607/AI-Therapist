"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyPassword = exports.findUserByEmail = exports.createUser = void 0;
const prismaClient_1 = require("../prisma/prismaClient");
const bcrypt_1 = __importDefault(require("bcrypt"));
const createUser = async (name, email, password) => {
    const hashedPassword = await bcrypt_1.default.hash(password, 10);
    return await prismaClient_1.prisma.user.create({
        data: {
            name,
            email,
            password: hashedPassword,
        },
        select: {
            id: true,
            email: true,
            name: true,
            createdAt: true,
        },
    });
};
exports.createUser = createUser;
const findUserByEmail = async (email) => {
    return await prismaClient_1.prisma.user.findUnique({
        where: { email },
    });
};
exports.findUserByEmail = findUserByEmail;
const verifyPassword = async (plainPassword, hashedPassword) => {
    return await bcrypt_1.default.compare(plainPassword, hashedPassword);
};
exports.verifyPassword = verifyPassword;
