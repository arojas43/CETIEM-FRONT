import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";

// Usuario local para desarrollo
const LOCAL_USER = {
  email: "admin@local.dev",
  password: "admin123",
  name: "Administrador Local",
};

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  adapter: PrismaAdapter(prisma) as any,
  providers: [
    // Provider de credenciales para desarrollo local
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email y password requeridos");
        }

        // Para desarrollo: usar usuario hardcoded o crear en BD
        if (
          credentials.email === LOCAL_USER.email &&
          credentials.password === LOCAL_USER.password
        ) {
          // Buscar o crear usuario en BD
          let user = await prisma.user.findUnique({
            where: { email: LOCAL_USER.email },
          });

          if (!user) {
            user = await prisma.user.create({
              data: {
                email: LOCAL_USER.email,
                name: LOCAL_USER.name,
              },
            });
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
          };
        }

        throw new Error("Credenciales inválidas");
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
  pages: {
    signIn: "/auth/signin",
  },
  callbacks: {
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
  },
});
