export default async (req: Request) => {
  const url = new URL(req.url);
  const query = url.searchParams.get('q');

  if (!query || query.trim().length < 2) {
    return new Response(JSON.stringify({ results: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const appId = process.env.EDAMAM_APP_ID;
  const appKey = process.env.EDAMAM_APP_KEY;

  if (!appId || !appKey) {
    return new Response(JSON.stringify({ error: 'nutrition_api_not_configured' }), {
      status: 501,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const edamamUrl = new URL('https://api.edamam.com/api/food-database/v2/parser');
  edamamUrl.searchParams.set('ingr', query);
  edamamUrl.searchParams.set('app_id', appId);
  edamamUrl.searchParams.set('app_key', appKey);

  const res = await fetch(edamamUrl.toString());
  if (!res.ok) {
    return new Response(JSON.stringify({ error: 'edamam_fetch_failed' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const data = await res.json();
  const hints: any[] = data.hints ?? [];

  const results = hints.slice(0, 12).map((h) => {
    const food = h.food;
    const n = food.nutrients ?? {};
    return {
      foodId: food.foodId,
      label: food.label,
      kcal100: Math.round(n.ENERC_KCAL ?? 0),
      protein100: Math.round((n.PROCNT ?? 0) * 10) / 10,
      carbs100: Math.round((n.CHOCDF ?? 0) * 10) / 10,
      fat100: Math.round((n.FAT ?? 0) * 10) / 10,
    };
  });

  return new Response(JSON.stringify({ results }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
