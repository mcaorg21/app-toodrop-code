// Helper function to calculate distance between two points using Haversine formula
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

// Scheduled event handler for deactivating inactive hubs
export async function deactivateInactiveHubs(env: Env) {
  try {
    console.log("[Cron] Starting deactivation check for inactive hubs");
    
    // Get current time minus 1 hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    // Find all active hubs that haven't pinged in the last hour
    const { results: inactiveHubs } = await env.DB.prepare(
      `SELECT receiver_key, last_ping 
       FROM receiver_point_status 
       WHERE active_hub = 1 
       AND (last_ping IS NULL OR last_ping < ?)`
    ).bind(oneHourAgo).all();
    
    console.log(`[Cron] Found ${inactiveHubs.length} inactive hubs to deactivate`);
    
    // Deactivate each inactive hub
    for (const hub of inactiveHubs) {
      await env.DB.prepare(
        `UPDATE receiver_point_status 
         SET active_hub = 0, updated_at = CURRENT_TIMESTAMP 
         WHERE receiver_key = ?`
      ).bind(hub.receiver_key).run();
      
      console.log(`[Cron] Deactivated hub ${hub.receiver_key}, last ping: ${hub.last_ping || 'never'}`);
    }
    
    console.log("[Cron] Deactivation check completed");
    return { success: true, deactivated: inactiveHubs.length };
  } catch (error) {
    console.error("[Cron] Error deactivating inactive hubs:", error);
    throw error;
  }
}
