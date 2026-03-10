"use client";

import { User } from "next-auth";
import { AuthButton } from "@/components/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Upload, BarChart3, Settings } from "lucide-react";
import Link from "next/link";

interface DashboardViewProps {
  user: User;
}

export function DashboardView({ user }: DashboardViewProps) {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">Certificación IA</h1>
          </div>
          <AuthButton />
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">
            Bienvenido, {user?.name || user?.email}
          </h2>
          <p className="text-muted-foreground">
            Gestiona tus certificaciones empresariales con IA
          </p>
        </div>

        {/* Action Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <Upload className="h-8 w-8 text-primary mb-2" />
              <CardTitle>Subir Documentos</CardTitle>
              <CardDescription>
                Carga documentos PDF para análisis de certificación
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/dashboard/upload">
                <Button className="w-full">
                  <Upload className="mr-2 h-4 w-4" />
                  Subir Documento
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <FileText className="h-8 w-8 text-primary mb-2" />
              <CardTitle>Mis Certificaciones</CardTitle>
              <CardDescription>
                Visualiza y gestiona tus certificaciones
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/dashboard/certifications">
                <Button variant="outline" className="w-full">
                  <FileText className="mr-2 h-4 w-4" />
                  Ver Certificaciones
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <BarChart3 className="h-8 w-8 text-primary mb-2" />
              <CardTitle>Reportes</CardTitle>
              <CardDescription>
                Genera y exporta reportes de certificación
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/dashboard/reports">
                <Button variant="outline" className="w-full">
                  <BarChart3 className="mr-2 h-4 w-4" />
                  Ver Reportes
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Settings className="h-8 w-8 text-primary mb-2" />
              <CardTitle>Configuración</CardTitle>
              <CardDescription>
                Configura tu perfil y preferencias
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/dashboard/settings">
                <Button variant="outline" className="w-full">
                  <Settings className="mr-2 h-4 w-4" />
                  Configuración
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle>Actividad Reciente</CardTitle>
              <CardDescription>
                Últimos documentos procesados
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <p>No hay actividad reciente</p>
                <p className="text-sm">Sube tu primer documento para comenzar</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
