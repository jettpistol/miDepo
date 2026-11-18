-- miDepo pasa a ser dueño del stock: reservas por pedido, origen genérico de los registros
-- (Fierro o carga manual), módulos por empresa, escaneos con clave única, registro de errores
-- de escaneo, marcas de tiempo del pedido y un libro de movimientos que solo se puede agregar.

ALTER TABLE "empresas" ADD COLUMN "modo" text DEFAULT 'fierro' NOT NULL;--> statement-breakpoint
ALTER TABLE "empresas" ADD COLUMN "modulos" jsonb;--> statement-breakpoint

-- fierro_id → id_externo + origen. Lo que ya existe vino de Fierro.
DROP INDEX "productos_fierro";--> statement-breakpoint
DROP INDEX "clientes_fierro";--> statement-breakpoint
DROP INDEX "pedidos_fierro";--> statement-breakpoint
ALTER TABLE "productos" RENAME COLUMN "fierro_id" TO "id_externo";--> statement-breakpoint
ALTER TABLE "clientes" RENAME COLUMN "fierro_id" TO "id_externo";--> statement-breakpoint
ALTER TABLE "pedidos" RENAME COLUMN "fierro_id" TO "id_externo";--> statement-breakpoint
ALTER TABLE "recepciones" RENAME COLUMN "fierro_id" TO "id_externo";--> statement-breakpoint
ALTER TABLE "productos" ALTER COLUMN "id_externo" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "clientes" ALTER COLUMN "id_externo" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "pedidos" ALTER COLUMN "id_externo" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "productos" ADD COLUMN "origen" text DEFAULT 'fierro' NOT NULL;--> statement-breakpoint
ALTER TABLE "clientes" ADD COLUMN "origen" text DEFAULT 'fierro' NOT NULL;--> statement-breakpoint
ALTER TABLE "pedidos" ADD COLUMN "origen" text DEFAULT 'fierro' NOT NULL;--> statement-breakpoint
ALTER TABLE "recepciones" ADD COLUMN "origen" text DEFAULT 'fierro' NOT NULL;--> statement-breakpoint
UPDATE "recepciones" SET "origen" = 'manual' WHERE "id_externo" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "productos_origen" ON "productos" USING btree ("empresa_id","origen","id_externo");--> statement-breakpoint
CREATE UNIQUE INDEX "clientes_origen" ON "clientes" USING btree ("empresa_id","origen","id_externo");--> statement-breakpoint
CREATE UNIQUE INDEX "pedidos_origen" ON "pedidos" USING btree ("empresa_id","origen","id_externo");--> statement-breakpoint

-- Marcas de tiempo del recorrido del pedido.
ALTER TABLE "pedidos" ADD COLUMN "tomado_en" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "pedidos" ADD COLUMN "preparado_en" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "pedidos" ADD COLUMN "empacado_en" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "pedidos" ADD COLUMN "despachado_en" timestamp with time zone;--> statement-breakpoint

-- Reservas.
ALTER TABLE "pedido_lineas" ADD COLUMN "reservado" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE TABLE "comprometido" (
	"empresa_id" integer NOT NULL,
	"producto_id" integer NOT NULL,
	"cantidad" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "comprometido_empresa_id_producto_id_pk" PRIMARY KEY("empresa_id","producto_id"),
	CONSTRAINT "comprometido_no_negativo" CHECK ("cantidad" >= 0)
);--> statement-breakpoint
ALTER TABLE "comprometido" ADD CONSTRAINT "comprometido_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comprometido" ADD CONSTRAINT "comprometido_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Los pedidos que ya estaban en picking tienen paradas pendientes: esas unidades quedan apartadas.
UPDATE "pedido_lineas" l SET "reservado" = t.n FROM (SELECT "linea_id", SUM("cantidad" - "pickeado") AS n FROM "tareas_picking" WHERE "estado" = 'pendiente' GROUP BY "linea_id") t WHERE t."linea_id" = l."id";--> statement-breakpoint
INSERT INTO "comprometido" ("empresa_id", "producto_id", "cantidad") SELECT p."empresa_id", l."producto_id", SUM(l."reservado") FROM "pedido_lineas" l JOIN "pedidos" p ON p."id" = l."pedido_id" WHERE l."reservado" > 0 GROUP BY p."empresa_id", l."producto_id";--> statement-breakpoint

-- Escaneos que no deben aplicarse dos veces.
CREATE TABLE "claves_una_vez" (
	"empresa_id" integer NOT NULL,
	"clave" text NOT NULL,
	"resultado" text,
	"creado" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "claves_una_vez_empresa_id_clave_pk" PRIMARY KEY("empresa_id","clave")
);--> statement-breakpoint
ALTER TABLE "claves_una_vez" ADD CONSTRAINT "claves_una_vez_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

-- Escaneos rechazados.
CREATE TABLE "errores_escaneo" (
	"id" serial PRIMARY KEY NOT NULL,
	"empresa_id" integer NOT NULL,
	"usuario_id" integer,
	"flujo" text NOT NULL,
	"tipo" text DEFAULT 'otro' NOT NULL,
	"mensaje" text NOT NULL,
	"detalle" jsonb,
	"creado" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "errores_escaneo" ADD CONSTRAINT "errores_escaneo_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "errores_escaneo" ADD CONSTRAINT "errores_escaneo_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "errores_escaneo_empresa" ON "errores_escaneo" USING btree ("empresa_id","creado");--> statement-breakpoint

-- El libro de movimientos solo se agrega: nada se corrige ni se borra, se compensa con otro movimiento.
CREATE FUNCTION "movimientos_solo_agregar"() RETURNS trigger AS $fn$
BEGIN
  RAISE EXCEPTION 'movimientos es un libro de solo agregar: no se puede modificar ni borrar. Registrá un movimiento que compense.';
END;
$fn$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER "movimientos_solo_agregar" BEFORE UPDATE OR DELETE ON "movimientos" FOR EACH ROW EXECUTE FUNCTION "movimientos_solo_agregar"();--> statement-breakpoint
CREATE TRIGGER "movimientos_sin_vaciar" BEFORE TRUNCATE ON "movimientos" FOR EACH STATEMENT EXECUTE FUNCTION "movimientos_solo_agregar"();
