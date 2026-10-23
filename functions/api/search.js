/**
 * GET /api/search?q=<text>        → gợi ý địa điểm (Vietmap Autocomplete v4)
 * GET /api/search?ref_id=<ref_id>  → tọa độ chi tiết (Vietmap Place v4)
 *
 * Key nằm ở server (secret VIETMAP_KEY), không lộ ra trình duyệt.
 * Autocomplete không trả lat/lng → resolve bằng Place v4 khi user chọn.
 */
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim();
  const refId = url.searchParams.get("ref_id") || "";
  if (!env.VIETMAP_KEY) {
    return Response.json({ error: "missing_key" }, { status: 503 });
  }
  const key = encodeURIComponent(env.VIETMAP_KEY);
  try {
    if (refId) {
      const r = await fetch(
        `https://maps.vietmap.vn/api/place/v4?apikey=${key}&refid=${encodeURIComponent(refId)}`,
        { signal: AbortSignal.timeout(8000) });
      if (!r.ok) return Response.json({ error: "place_failed" }, { status: 502 });
      const j = await r.json();
      const lat = j.lat ?? j.latitude ?? null;
      const lng = j.lng ?? j.lon ?? j.longitude ?? null;
      return Response.json({ lat, lng, display: j.display || j.name || "", name: j.name || "" });
    }
    if (q.length < 2) return Response.json({ results: [] });
    const r = await fetch(
      `https://maps.vietmap.vn/api/autocomplete/v4?apikey=${key}&text=${encodeURIComponent(q)}`,
      { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return Response.json({ error: "search_failed", status: r.status }, { status: 502 });
    const arr = await r.json();
    const results = (Array.isArray(arr) ? arr : []).slice(0, 6).map((x) => ({
      ref_id: x.ref_id, name: x.name || "", display: x.display || "", address: x.address || "",
    }));
    return Response.json({ results });
  } catch {
    return Response.json({ error: "network" }, { status: 502 });
  }
}
