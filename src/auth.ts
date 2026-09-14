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
