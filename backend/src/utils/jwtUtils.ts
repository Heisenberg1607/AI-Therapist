import jwt from "jsonwebtoken";

const JWT_SECRET = "_Atharva$Kurumbhatte@123_"  // this is a secret key for json web token
const JWT_EXPIRATION = "3d";

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


