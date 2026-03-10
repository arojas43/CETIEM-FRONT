import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { FileText, Upload, Brain, CheckCircle, Clock, TrendingUp } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { signOut } from "next-auth/react";
import { DocumentListPaginated } from "@/components/document-list-paginated";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/signin");
  }

  // Obtener estadísticas reales de la BD
  const [total, processing, indexed, analyzed, failed, totalIndices] = await Promise.all([
    prisma.document.count({ where: { userId: session.user!.id } }),
    prisma.document.count({ where: { userId: session.user!.id, status: "PROCESSING" } }),
    prisma.document.count({ where: { userId: session.user!.id, status: { in: ["INDEXED", "ANALYZED"] } } }),
    prisma.document.count({ where: { userId: session.user!.id, status: "ANALYZED" } }),
    prisma.document.count({ where: { userId: session.user!.id, status: "FAILED" } }),
    prisma.pageIndex.count(),
  ]);

  // Estadísticas
  const stats = {
    total,
    processing,
    indexed,
    analyzed,
    failed,
    entities: totalIndices,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-xs text-gray-500">Gestión de certificaciones</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-gray-900">
                {session.user.name || session.user.email}
              </p>
              <p className="text-xs text-gray-500">{session.user.email}</p>
            </div>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/auth/signin" });
              }}
            >
              <Button variant="outline" type="submit">
                Cerrar Sesión
              </Button>
            </form>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            ¡Bienvenido, {session.user.name || session.user.email}!
          </h2>
          <p className="text-gray-600">
            Gestiona tus documentos y certificaciones empresariales con IA
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Total Documentos
              </CardTitle>
              <FileText className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">{stats.total}</div>
              <p className="text-xs text-gray-500 mt-1">Todos los documentos</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                En Procesamiento
              </CardTitle>
              <Clock className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">{stats.processing}</div>
              <p className="text-xs text-gray-500 mt-1">Analizando con IA</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Indexados
              </CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">{stats.indexed}</div>
              <p className="text-xs text-gray-500 mt-1">Listos para consultar</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Entidades Extraídas
              </CardTitle>
              <Brain className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">{stats.entities}</div>
              <p className="text-xs text-gray-500 mt-1">Secciones identificadas</p>
            </CardContent>
          </Card>
        </div>

        {/* Action Cards */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <Link href="/dashboard/upload">
              <CardHeader>
                <div className="h-12 w-12 bg-blue-100 rounded-xl flex items-center justify-center mb-3">
                  <Upload className="h-6 w-6 text-blue-600" />
                </div>
                <CardTitle>Subir Nuevo Documento</CardTitle>
                <CardDescription>
                  Carga documentos PDF para análisis automático con IA
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-blue-600 hover:bg-blue-700">
                  <Upload className="mr-2 h-4 w-4" />
                  Subir Documento
                </Button>
              </CardContent>
            </Link>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <Link href="/dashboard/documents">
              <CardHeader>
                <div className="h-12 w-12 bg-indigo-100 rounded-xl flex items-center justify-center mb-3">
                  <TrendingUp className="h-6 w-6 text-indigo-600" />
                </div>
                <CardTitle>Ver Todos los Documentos</CardTitle>
                <CardDescription>
                  Explora y gestiona tu biblioteca documental
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full">
                  <FileText className="mr-2 h-4 w-4" />
                  Ver Documentos
                </Button>
              </CardContent>
            </Link>
          </Card>
        </div>

        {/* Recent Documents */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Documentos Recientes</CardTitle>
                <CardDescription>
                  Últimos documentos procesados
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <DocumentListPaginated />
          </CardContent>
        </Card>

        {/* Info Section */}
        <div className="grid md:grid-cols-3 gap-6 mt-8">
          <Card className="bg-blue-50 border-blue-200">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Brain className="h-5 w-5 text-blue-600" />
                PageIndex
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Analiza la estructura jerárquica de documentos PDF usando IA. 
                Detecta capítulos, secciones y crea índices navegables.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-indigo-50 border-indigo-200">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Brain className="h-5 w-5 text-indigo-600" />
                Cognee
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Extrae entidades y relaciones del texto. Identifica normas, 
                requisitos, empresas y fechas importantes.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-purple-50 border-purple-200">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5 text-purple-600" />
                FalkorDB
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Base de datos de grafos que almacena el conocimiento extraído. 
                Permite consultas complejas de relaciones.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
