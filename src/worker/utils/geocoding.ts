// Fetch coordinates from Nominatim API
export async function fetchCoordinates(
  street: string,
  number: string,
  neighborhood: string,
  city: string,
  state: string,
  cep: string
): Promise<{ latitude: number | null; longitude: number | null }> {
  let latitude: number | null = null;
  let longitude: number | null = null;
  
  try {
    const searchQuery = `${street}, ${number}, ${neighborhood}, ${city}, ${state}, ${cep}, Brazil`;
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=1`;
    
    const geoResponse = await fetch(nominatimUrl, {
      headers: {
        'User-Agent': 'Toodrop-App/1.0',
      },
    });
    
    if (geoResponse.ok) {
      const geoData = await geoResponse.json() as Array<{ lat: string; lon: string }>;
      if (geoData && geoData.length > 0) {
        latitude = parseFloat(geoData[0].lat);
        longitude = parseFloat(geoData[0].lon);
      }
    }
  } catch (error) {
    console.error("Error fetching coordinates:", error);
    // Continue without coordinates if geocoding fails
  }

  return { latitude, longitude };
}
