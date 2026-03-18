import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || ""; // this is a secret key for json web token
const JWT_EXPIRATION = "3d";

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not set in environment variables");
}

interface JwtPayload {
  userId: string;
}

export const generateToken = (userId: string) => {
    return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRATION });
}

export const verifyToken = (token: string): JwtPayload | null => {
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (typeof decoded === "string") {
            return null;
        }
        return decoded as JwtPayload;
    } catch (error) {
        return null;
    }
}


