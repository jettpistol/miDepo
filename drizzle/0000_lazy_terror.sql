CREATE TABLE "caja_items" (
	"caja_id" integer NOT NULL,
	"producto_id" integer NOT NULL,
	"cantidad" integer NOT NULL,
	CONSTRAINT "caja_items_caja_id_producto_id_pk" PRIMARY KEY("caja_id","producto_id")
);
--> statement-breakpoint
CREATE TABLE "cajas" (
	"id" serial PRIMARY KEY NOT NULL,
	"empresa_id" integer NOT NULL,
	"pedido_id" integer NOT NULL,
	"numero" integer NOT NULL,
	"peso_gramos" integer,
	"estado" text DEFAULT 'abierta' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clientes" (
	"id" serial PRIMARY KEY NOT NULL,
	"empresa_id" integer NOT NULL,
	"fierro_id" text NOT NULL,
	"nombre" text NOT NULL,
	"direccion" text,
	"localidad" text,
	"provincia" text
);
--> statement-breakpoint
CREATE TABLE "conteo_lineas" (
	"conteo_id" integer NOT NULL,
	"ubicacion_id" integer NOT NULL,
	"producto_id" integer NOT NULL,
	"contado" integer DEFAULT 0 NOT NULL,
	"sistema" integer,
	CONSTRAINT "conteo_lineas_conteo_id_ubicacion_id_producto_id_pk" PRIMARY KEY("conteo_id","ubicacion_id","producto_id")
);
--> statement-breakpoint
CREATE TABLE "conteo_ubicaciones" (
	"conteo_id" integer NOT NULL,
	"ubicacion_id" integer NOT NULL,
	"estado" text DEFAULT 'pendiente' NOT NULL,
	"contado_por" integer,
	CONSTRAINT "conteo_ubicaciones_conteo_id_ubicacion_id_pk" PRIMARY KEY("conteo_id","ubicacion_id")
);
--> statement-breakpoint
CREATE TABLE "conteos" (
	"id" serial PRIMARY KEY NOT NULL,
	"empresa_id" integer NOT NULL,
	"nombre" text NOT NULL,
	"estado" text DEFAULT 'abierto' NOT NULL,
	"fecha" timestamp with time zone DEFAULT now() NOT NULL,
	"enviado_a_fierro" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "devolucion_lineas" (
	"devolucion_id" integer NOT NULL,
	"producto_id" integer NOT NULL,
	"estado_libro" text NOT NULL,
	"cantidad" integer NOT NULL,
	CONSTRAINT "devolucion_lineas_devolucion_id_producto_id_estado_libro_pk" PRIMARY KEY("devolucion_id","producto_id","estado_libro")
);
--> statement-breakpoint
CREATE TABLE "devoluciones" (
	"id" serial PRIMARY KEY NOT NULL,
	"empresa_id" integer NOT NULL,
	"numero" text NOT NULL,
	"cliente_id" integer NOT NULL,
	"estado" text DEFAULT 'en_curso' NOT NULL,
	"fecha" timestamp with time zone DEFAULT now() NOT NULL,
	"enviado_a_fierro" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "empresas" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"slug" text NOT NULL,
	"esquema_ubicaciones" jsonb,
	"sim_pedidos" integer DEFAULT 0 NOT NULL,
	"sim_ingresos" integer DEFAULT 0 NOT NULL,
	"sim_semilla" integer DEFAULT 1 NOT NULL,
	"sim_titulos" integer DEFAULT 500 NOT NULL,
	"sim_clientes" integer DEFAULT 60 NOT NULL,
	"ultima_sync" timestamp with time zone,
	"creado" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "empresas_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "fierro_stock" (
	"empresa_id" integer NOT NULL,
	"producto_id" integer NOT NULL,
	"cantidad" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "fierro_stock_empresa_id_producto_id_pk" PRIMARY KEY("empresa_id","producto_id")
);
--> statement-breakpoint
CREATE TABLE "intentos_login" (
	"clave" text PRIMARY KEY NOT NULL,
	"cantidad" integer DEFAULT 0 NOT NULL,
	"bloqueado_hasta" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "movimientos" (
	"id" serial PRIMARY KEY NOT NULL,
	"empresa_id" integer NOT NULL,
	"producto_id" integer NOT NULL,
	"desde_id" integer,
	"hacia_id" integer,
	"cantidad" integer NOT NULL,
	"motivo" text NOT NULL,
	"referencia" text,
	"usuario_id" integer,
	"creado" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "passkeys" (
	"id" text PRIMARY KEY NOT NULL,
	"usuario_id" integer NOT NULL,
	"clave_publica" text NOT NULL,
	"contador" integer DEFAULT 0 NOT NULL,
	"transportes" text,
	"nombre" text DEFAULT 'Llave de acceso' NOT NULL,
	"creado" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pedido_lineas" (
	"id" serial PRIMARY KEY NOT NULL,
	"pedido_id" integer NOT NULL,
	"producto_id" integer NOT NULL,
	"cantidad" integer NOT NULL,
	"pickeado" integer DEFAULT 0 NOT NULL,
	"empacado" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pedidos" (
	"id" serial PRIMARY KEY NOT NULL,
	"empresa_id" integer NOT NULL,
	"fierro_id" text NOT NULL,
	"numero" text NOT NULL,
	"cliente_id" integer NOT NULL,
	"modalidad" text DEFAULT 'firme' NOT NULL,
	"estado" text DEFAULT 'pendiente' NOT NULL,
	"fecha" timestamp with time zone DEFAULT now() NOT NULL,
	"tomado_por" integer,
	"enviado_a_fierro" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "productos" (
	"id" serial PRIMARY KEY NOT NULL,
	"empresa_id" integer NOT NULL,
	"fierro_id" text NOT NULL,
	"codigo_interno" text NOT NULL,
	"isbn" text,
	"codigo_barras" text NOT NULL,
	"titulo" text NOT NULL,
	"autor" text,
	"sello" text,
	"tipo" text DEFAULT 'libro' NOT NULL,
	"precio" integer DEFAULT 0 NOT NULL,
	"peso_gramos" integer DEFAULT 300 NOT NULL,
	"activo" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recepcion_lineas" (
	"id" serial PRIMARY KEY NOT NULL,
	"recepcion_id" integer NOT NULL,
	"producto_id" integer NOT NULL,
	"esperado" integer DEFAULT 0 NOT NULL,
	"recibido" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recepciones" (
	"id" serial PRIMARY KEY NOT NULL,
	"empresa_id" integer NOT NULL,
	"fierro_id" text,
	"numero" text NOT NULL,
	"proveedor" text NOT NULL,
	"estado" text DEFAULT 'pendiente' NOT NULL,
	"fecha" timestamp with time zone DEFAULT now() NOT NULL,
	"enviado_a_fierro" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sesiones" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"usuario_id" integer NOT NULL,
	"expira" timestamp with time zone NOT NULL,
	"creado" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock" (
	"empresa_id" integer NOT NULL,
	"producto_id" integer NOT NULL,
	"ubicacion_id" integer NOT NULL,
	"cantidad" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "stock_producto_id_ubicacion_id_pk" PRIMARY KEY("producto_id","ubicacion_id")
);
--> statement-breakpoint
CREATE TABLE "tareas_picking" (
	"id" serial PRIMARY KEY NOT NULL,
	"pedido_id" integer NOT NULL,
	"linea_id" integer NOT NULL,
	"producto_id" integer NOT NULL,
	"ubicacion_id" integer,
	"cantidad" integer NOT NULL,
	"pickeado" integer DEFAULT 0 NOT NULL,
	"estado" text DEFAULT 'pendiente' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ubicaciones" (
	"id" serial PRIMARY KEY NOT NULL,
	"empresa_id" integer NOT NULL,
	"codigo" text NOT NULL,
	"tipo" text DEFAULT 'estanteria' NOT NULL,
	"activa" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" serial PRIMARY KEY NOT NULL,
	"empresa_id" integer NOT NULL,
	"nombre" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text,
	"pin_hmac" text,
	"rol" text DEFAULT 'operario' NOT NULL,
	"acento" text DEFAULT '#002FA7' NOT NULL,
	"tema" text DEFAULT 'sistema' NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"creado" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usuarios_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "caja_items" ADD CONSTRAINT "caja_items_caja_id_cajas_id_fk" FOREIGN KEY ("caja_id") REFERENCES "public"."cajas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "caja_items" ADD CONSTRAINT "caja_items_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cajas" ADD CONSTRAINT "cajas_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cajas" ADD CONSTRAINT "cajas_pedido_id_pedidos_id_fk" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conteo_lineas" ADD CONSTRAINT "conteo_lineas_conteo_id_conteos_id_fk" FOREIGN KEY ("conteo_id") REFERENCES "public"."conteos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conteo_lineas" ADD CONSTRAINT "conteo_lineas_ubicacion_id_ubicaciones_id_fk" FOREIGN KEY ("ubicacion_id") REFERENCES "public"."ubicaciones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conteo_lineas" ADD CONSTRAINT "conteo_lineas_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conteo_ubicaciones" ADD CONSTRAINT "conteo_ubicaciones_conteo_id_conteos_id_fk" FOREIGN KEY ("conteo_id") REFERENCES "public"."conteos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conteo_ubicaciones" ADD CONSTRAINT "conteo_ubicaciones_ubicacion_id_ubicaciones_id_fk" FOREIGN KEY ("ubicacion_id") REFERENCES "public"."ubicaciones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conteo_ubicaciones" ADD CONSTRAINT "conteo_ubicaciones_contado_por_usuarios_id_fk" FOREIGN KEY ("contado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conteos" ADD CONSTRAINT "conteos_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devolucion_lineas" ADD CONSTRAINT "devolucion_lineas_devolucion_id_devoluciones_id_fk" FOREIGN KEY ("devolucion_id") REFERENCES "public"."devoluciones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devolucion_lineas" ADD CONSTRAINT "devolucion_lineas_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devoluciones" ADD CONSTRAINT "devoluciones_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devoluciones" ADD CONSTRAINT "devoluciones_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fierro_stock" ADD CONSTRAINT "fierro_stock_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fierro_stock" ADD CONSTRAINT "fierro_stock_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_desde_id_ubicaciones_id_fk" FOREIGN KEY ("desde_id") REFERENCES "public"."ubicaciones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_hacia_id_ubicaciones_id_fk" FOREIGN KEY ("hacia_id") REFERENCES "public"."ubicaciones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passkeys" ADD CONSTRAINT "passkeys_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedido_lineas" ADD CONSTRAINT "pedido_lineas_pedido_id_pedidos_id_fk" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedido_lineas" ADD CONSTRAINT "pedido_lineas_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_tomado_por_usuarios_id_fk" FOREIGN KEY ("tomado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "productos" ADD CONSTRAINT "productos_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recepcion_lineas" ADD CONSTRAINT "recepcion_lineas_recepcion_id_recepciones_id_fk" FOREIGN KEY ("recepcion_id") REFERENCES "public"."recepciones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recepcion_lineas" ADD CONSTRAINT "recepcion_lineas_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recepciones" ADD CONSTRAINT "recepciones_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sesiones" ADD CONSTRAINT "sesiones_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock" ADD CONSTRAINT "stock_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock" ADD CONSTRAINT "stock_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock" ADD CONSTRAINT "stock_ubicacion_id_ubicaciones_id_fk" FOREIGN KEY ("ubicacion_id") REFERENCES "public"."ubicaciones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tareas_picking" ADD CONSTRAINT "tareas_picking_pedido_id_pedidos_id_fk" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tareas_picking" ADD CONSTRAINT "tareas_picking_linea_id_pedido_lineas_id_fk" FOREIGN KEY ("linea_id") REFERENCES "public"."pedido_lineas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tareas_picking" ADD CONSTRAINT "tareas_picking_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tareas_picking" ADD CONSTRAINT "tareas_picking_ubicacion_id_ubicaciones_id_fk" FOREIGN KEY ("ubicacion_id") REFERENCES "public"."ubicaciones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ubicaciones" ADD CONSTRAINT "ubicaciones_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cajas_pedido" ON "cajas" USING btree ("pedido_id");--> statement-breakpoint
CREATE UNIQUE INDEX "clientes_fierro" ON "clientes" USING btree ("empresa_id","fierro_id");--> statement-breakpoint
CREATE INDEX "movimientos_producto" ON "movimientos" USING btree ("producto_id","creado");--> statement-breakpoint
CREATE INDEX "pedido_lineas_pedido" ON "pedido_lineas" USING btree ("pedido_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pedidos_fierro" ON "pedidos" USING btree ("empresa_id","fierro_id");--> statement-breakpoint
CREATE INDEX "pedidos_estado" ON "pedidos" USING btree ("empresa_id","estado");--> statement-breakpoint
CREATE UNIQUE INDEX "productos_fierro" ON "productos" USING btree ("empresa_id","fierro_id");--> statement-breakpoint
CREATE INDEX "productos_barras" ON "productos" USING btree ("empresa_id","codigo_barras");--> statement-breakpoint
CREATE INDEX "productos_isbn" ON "productos" USING btree ("empresa_id","isbn");--> statement-breakpoint
CREATE INDEX "productos_interno" ON "productos" USING btree ("empresa_id","codigo_interno");--> statement-breakpoint
CREATE UNIQUE INDEX "recepcion_lineas_prod" ON "recepcion_lineas" USING btree ("recepcion_id","producto_id");--> statement-breakpoint
CREATE INDEX "recepciones_estado" ON "recepciones" USING btree ("empresa_id","estado");--> statement-breakpoint
CREATE INDEX "stock_ubicacion" ON "stock" USING btree ("ubicacion_id");--> statement-breakpoint
CREATE INDEX "tareas_pedido" ON "tareas_picking" USING btree ("pedido_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ubicaciones_codigo" ON "ubicaciones" USING btree ("empresa_id","codigo");--> statement-breakpoint
CREATE UNIQUE INDEX "usuarios_pin" ON "usuarios" USING btree ("empresa_id","pin_hmac");