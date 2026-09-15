import { Request, Response, NextFunction } from "express";

/**
 * Autenticación simple por Bearer token.
 * NUNCA aceptar el token vía query string (?key=) — queda en logs de
 * proxies, CDNs y el propio Railway. Solo header Authorization.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.header("authorization");

  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "missing_or_malformed_authorization_header" });
  }

  const token = header.slice("Bearer ".length).trim();
  const expected = process.env.PROXY_TOKEN;

  if (!expected) {
    // Falla cerrada: si no hay token configurado en el servidor, no se acepta nada.
    return res.status(500).json({ error: "server_misconfigured_no_proxy_token" });
  }

  if (token !== expected) {
    return res.status(403).json({ error: "invalid_token" });
  }

  next();
}

/**
 * Validación de token vía query string, SOLO para /run.
 * Existe porque algunos clientes (ej. apps que solo hacen GET a una URL,
 * sin poder mandar headers custom) no tienen forma de mandar un Bearer.
 * Es un compromiso deliberado, no un descuido: usa un token DISTINTO al
 * PROXY_TOKEN de la API "seria" (GET_ACCESS_TOKEN), para que si este se
 * filtra en un log, no comprometa también el acceso vía Bearer/POST.
 * Rótalo seguido — este es el que más expuesto está.
 */
export function isValidGetToken(token: unknown): boolean {
  const expected = process.env.GET_ACCESS_TOKEN;
  return typeof token === "string" && typeof expected === "string" && expected.length > 0 && token === expected;
}
