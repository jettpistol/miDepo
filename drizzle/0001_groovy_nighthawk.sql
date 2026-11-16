CREATE TABLE "usuario_fotos" (
	"usuario_id" integer PRIMARY KEY NOT NULL,
	"datos" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "usuarios" ADD COLUMN "foto_version" integer;--> statement-breakpoint
ALTER TABLE "usuario_fotos" ADD CONSTRAINT "usuario_fotos_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;