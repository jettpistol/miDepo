/**
 * Esquemas de nombres para ubicaciones. Un esquema es una lista de tramos (pasillo, estante,
 * nivel...) unidos por un separador. Cada depósito elige un modelo o arma el suyo.
 */
export type Tramo = {
  nombre: string;
  tipo: "letras" | "numeros";
  /** Cuántos valores tiene el tramo (A..H = 8; 01..20 = 20). */
  cantidad: number;
  /** Solo para números: cuántos dígitos se muestran (2 → 01, 02...). */
  digitos?: number;
  /** Texto fijo antes del valor (por ejemplo "E" en E014). */
  prefijo?: string;
};

export type Esquema = { id: string; separador: string; tramos: Tramo[] };

export const MODELOS: { id: string; nombre: string; descripcion: string; paraQuien: string; esquema: Esquema }[] = [
  {
    id: "pasillo-estante-nivel",
    nombre: "Pasillo · Estante · Nivel",
    descripcion: "Una letra por pasillo, un número por estantería y un número por nivel, contando desde abajo.",
    paraQuien: "El más común. Sirve para casi cualquier depósito con pasillos rectos.",
    esquema: {
      id: "pasillo-estante-nivel",
      separador: "-",
      tramos: [
        { nombre: "Pasillo", tipo: "letras", cantidad: 8 },
        { nombre: "Estante", tipo: "numeros", cantidad: 20, digitos: 2 },
        { nombre: "Nivel", tipo: "numeros", cantidad: 5, digitos: 1 },
      ],
    },
  },
  {
    id: "estanteria-nivel",
    nombre: "Estantería numerada · Nivel",
    descripcion: "Cada estantería tiene un número corrido y cada nivel el suyo.",
    paraQuien: "Depósitos chicos o sin pasillos definidos: un salón con estanterías contra las paredes.",
    esquema: {
      id: "estanteria-nivel",
      separador: "-",
      tramos: [
        { nombre: "Estantería", tipo: "numeros", cantidad: 30, digitos: 2, prefijo: "E" },
        { nombre: "Nivel", tipo: "numeros", cantidad: 5, digitos: 1 },
      ],
    },
  },
  {
    id: "sector-pasillo-estante-nivel",
    nombre: "Sector · Pasillo · Estante · Nivel",
    descripcion: "Agrega un sector adelante: planta baja y entrepiso, o dos galpones.",
    paraQuien: "Depósitos con más de un ambiente o más de un piso.",
    esquema: {
      id: "sector-pasillo-estante-nivel",
      separador: "-",
      tramos: [
        { nombre: "Sector", tipo: "numeros", cantidad: 2, digitos: 1, prefijo: "S" },
        { nombre: "Pasillo", tipo: "letras", cantidad: 6 },
        { nombre: "Estante", tipo: "numeros", cantidad: 12, digitos: 2 },
        { nombre: "Nivel", tipo: "numeros", cantidad: 5, digitos: 1 },
      ],
    },
  },
  {
    id: "estante-nivel-posicion",
    nombre: "Estante · Nivel · Posición",
    descripcion: "Además del nivel, numera cada hueco del estante de izquierda a derecha.",
    paraQuien: "Quien guarda muchos títulos distintos por estante y quiere encontrar cada uno sin buscar.",
    esquema: {
      id: "estante-nivel-posicion",
      separador: "-",
      tramos: [
        { nombre: "Estante", tipo: "numeros", cantidad: 20, digitos: 2 },
        { nombre: "Nivel", tipo: "numeros", cantidad: 5, digitos: 1 },
        { nombre: "Posición", tipo: "numeros", cantidad: 6, digitos: 1, prefijo: "P" },
      ],
    },
  },
];

const LETRAS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function valor(t: Tramo, i: number) {
  const base = t.tipo === "letras" ? letras(i) : String(i + 1).padStart(t.digitos ?? 1, "0");
  return (t.prefijo ?? "") + base;
}

function letras(i: number): string {
  return i < 26 ? LETRAS[i] : letras(Math.floor(i / 26) - 1) + LETRAS[i % 26];
}

export function totalUbicaciones(e: Esquema) {
  return e.tramos.reduce((n, t) => n * Math.max(1, t.cantidad), 1);
}

export const MAXIMO_UBICACIONES = 20000;

/** Genera todos los códigos del esquema, en el orden en que se recorre el depósito. */
export function generarCodigos(e: Esquema, limite = MAXIMO_UBICACIONES): string[] {
  const salida: string[] = [];
  const armar = (nivel: number, partes: string[]) => {
    if (salida.length >= limite) return;
    if (nivel === e.tramos.length) {
      salida.push(partes.join(e.separador).toUpperCase());
      return;
    }
    for (let i = 0; i < e.tramos[nivel].cantidad; i++) armar(nivel + 1, [...partes, valor(e.tramos[nivel], i)]);
  };
  if (e.tramos.length > 0) armar(0, []);
  return salida;
}

/** Valida un esquema que viene de un formulario. Devuelve el esquema limpio o un mensaje. */
export function validarEsquema(e: Esquema): string | null {
  if (e.tramos.length < 1 || e.tramos.length > 5) return "El esquema necesita entre 1 y 5 tramos.";
  if (!/^[-._/ ]?$/.test(e.separador)) return "El separador puede ser guion, punto, barra, guion bajo o nada.";
  for (const t of e.tramos) {
    if (!t.nombre.trim()) return "Cada tramo necesita un nombre.";
    if (!Number.isInteger(t.cantidad) || t.cantidad < 1 || t.cantidad > 999) return `"${t.nombre}": la cantidad va de 1 a 999.`;
    if (t.prefijo && !/^[A-Za-z0-9]{0,4}$/.test(t.prefijo)) return `"${t.nombre}": el prefijo admite hasta 4 letras o números.`;
  }
  if (totalUbicaciones(e) > MAXIMO_UBICACIONES) return `Son demasiadas ubicaciones (máximo ${MAXIMO_UBICACIONES}).`;
  return null;
}
