import Link from "next/link";
import { FileText, Upload, Brain, Shield, CheckCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Certificación IA</h1>
              <p className="text-xs text-gray-500">Análisis documental inteligente</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/auth/signin">
              <Button variant="outline">Iniciar Sesión</Button>
            </Link>
            <Link href="/dashboard">
              <Button className="bg-blue-600 hover:bg-blue-700">
                Dashboard
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="container mx-auto px-4">
        <section className="py-20 text-center">
          <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-800 px-4 py-2 rounded-full text-sm font-medium mb-6">
            <Brain className="h-4 w-4" />
            Potenciado por NVIDIA NIM + FalkorDB
          </div>
          
          <h2 className="text-5xl font-bold text-gray-900 mb-6 max-w-4xl mx-auto">
            Certificación Empresarial con{" "}
            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Inteligencia Artificial
            </span>
          </h2>
          
          <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto">
            Analiza documentos PDF automáticamente, extrae requisitos normativos 
            y genera certificaciones empresariales en minutos.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/dashboard/upload">
              <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-lg px-8 py-6">
                <Upload className="mr-2 h-5 w-5" />
                Subir Documento
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button size="lg" variant="outline" className="text-lg px-8 py-6">
                <FileText className="mr-2 h-5 w-5" />
                Ver Documentos
              </Button>
            </Link>
          </div>
        </section>

        {/* Features */}
        <section className="py-16">
          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 hover:shadow-xl transition-shadow">
              <div className="h-14 w-14 bg-blue-100 rounded-xl flex items-center justify-center mb-6">
                <Brain className="h-7 w-7 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                PageIndex - Análisis Jerárquico
              </h3>
              <p className="text-gray-600 mb-4">
                Extrae automáticamente la estructura de documentos PDF manteniendo 
                la jerarquía de secciones y capítulos.
              </p>
              <ul className="space-y-2 text-sm text-gray-500">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Detección de tabla de contenido
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Indexación por páginas
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Búsqueda contextual inteligente
                </li>
              </ul>
            </div>

            {/* Feature 2 */}
            <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 hover:shadow-xl transition-shadow">
              <div className="h-14 w-14 bg-indigo-100 rounded-xl flex items-center justify-center mb-6">
                <Shield className="h-7 w-7 text-indigo-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                Cognee + FalkorDB - Grafo de Conocimiento
              </h3>
              <p className="text-gray-600 mb-4">
                Construye una red de conocimiento conectando empresas, normas, 
                requisitos y certificaciones.
              </p>
              <ul className="space-y-2 text-sm text-gray-500">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Extracción de entidades
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Relaciones entre conceptos
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Consultas complejas en tiempo real
                </li>
              </ul>
            </div>

            {/* Feature 3 */}
            <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 hover:shadow-xl transition-shadow">
              <div className="h-14 w-14 bg-purple-100 rounded-xl flex items-center justify-center mb-6">
                <Upload className="h-7 w-7 text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                Procesamiento Automático
              </h3>
              <p className="text-gray-600 mb-4">
                Sube documentos PDF y deja que la IA haga el trabajo pesado 
                de análisis y clasificación.
              </p>
              <ul className="space-y-2 text-sm text-gray-500">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Cola de procesamiento asíncrona
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Notificaciones en tiempo real
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Exportación de reportes
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-16 bg-gray-50 rounded-3xl px-8 mb-16">
          <h3 className="text-3xl font-bold text-center text-gray-900 mb-12">
            ¿Cómo Funciona?
          </h3>
          
          <div className="grid md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="h-16 w-16 bg-blue-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                1
              </div>
              <h4 className="font-semibold text-gray-900 mb-2">Sube tu PDF</h4>
              <p className="text-sm text-gray-600">
                Arrastra documentos normativos, manuales o procedimientos
              </p>
            </div>
            
            <div className="text-center">
              <div className="h-16 w-16 bg-blue-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                2
              </div>
              <h4 className="font-semibold text-gray-900 mb-2">PageIndex Analiza</h4>
              <p className="text-sm text-gray-600">
                Extrae estructura jerárquica y crea índice de contenido
              </p>
            </div>
            
            <div className="text-center">
              <div className="h-16 w-16 bg-blue-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                3
              </div>
              <h4 className="font-semibold text-gray-900 mb-2">Cognee Extrae</h4>
              <p className="text-sm text-gray-600">
                Identifica entidades y construye grafo de conocimiento
              </p>
            </div>
            
            <div className="text-center">
              <div className="h-16 w-16 bg-blue-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                4
              </div>
              <h4 className="font-semibold text-gray-900 mb-2">Obtén Resultados</h4>
              <p className="text-sm text-gray-600">
                Visualiza certificaciones, requisitos y cumplimiento
              </p>
            </div>
          </div>
        </section>

        {/* Tech Stack */}
        <section className="py-12 border-t">
          <h3 className="text-center text-sm font-medium text-gray-500 mb-8">
            TECNOLOGÍAS QUE POTENCIAN EL SISTEMA
          </h3>
          <div className="flex flex-wrap justify-center items-center gap-8 opacity-60">
            <div className="text-center">
              <p className="font-semibold text-gray-700">Next.js 15</p>
              <p className="text-xs text-gray-500">Frontend</p>
            </div>
            <div className="text-center">
              <p className="font-semibold text-gray-700">NVIDIA NIM</p>
              <p className="text-xs text-gray-500">IA / LLM</p>
            </div>
            <div className="text-center">
              <p className="font-semibold text-gray-700">FalkorDB</p>
              <p className="text-xs text-gray-500">Grafos</p>
            </div>
            <div className="text-center">
              <p className="font-semibold text-gray-700">PostgreSQL</p>
              <p className="text-xs text-gray-500">Base de Datos</p>
            </div>
            <div className="text-center">
              <p className="font-semibold text-gray-700">BullMQ</p>
              <p className="text-xs text-gray-500">Colas</p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t bg-white mt-16">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Shield className="h-4 w-4" />
              <span>Sistema de Certificación con IA</span>
            </div>
            <p className="text-sm text-gray-500">
              Desarrollado con PageIndex + Cognee + FalkorDB
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
