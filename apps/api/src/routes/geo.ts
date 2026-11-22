import { Router } from "express";
import { z } from "zod";
import { reverseAddress, searchAddress } from "../geo";
import { wrap } from "../http";

export const geoRouter = Router();

geoRouter.get(
  "/geo/search",
  wrap(async (req, res) => {
    const query = z.string().trim().min(2).max(120).parse(req.query.q ?? "");
    try {
      const results = await searchAddress(query);
      res.json({ results });
    } catch {
      res.json({ results: [] });
    }
  }),
);

geoRouter.get(
  "/geo/reverse",
  wrap(async (req, res) => {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    z.number().gte(-90).lte(90).parse(lat);
    z.number().gte(-180).lte(180).parse(lng);
    try {
      res.json(await reverseAddress(lat, lng));
    } catch {
      res.json({ label: "", lat, lng });
    }
  }),
);
