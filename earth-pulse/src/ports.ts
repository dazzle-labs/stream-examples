// Major world ports — [latitude, longitude]
// Used to generate shipping routes across the globe

export const ports: readonly (readonly [number, number])[] = [
  // East Asia
  [31.2, 121.5],   // Shanghai
  [22.3, 114.2],   // Hong Kong
  [22.5, 113.9],   // Shenzhen
  [35.4, 139.6],   // Yokohama
  [35.1, 129.1],   // Busan
  [34.7, 135.4],   // Osaka/Kobe
  [36.1, 120.4],   // Qingdao
  [38.9, 117.7],   // Tianjin
  [25.0, 121.7],   // Kaohsiung
  [23.1, 113.3],   // Guangzhou
  // Southeast Asia
  [1.3, 103.8],    // Singapore
  [3.0, 101.4],    // Port Klang
  [1.5, 103.5],    // Tanjung Pelepas
  [-6.1, 106.9],   // Jakarta/Tanjung Priok
  [10.8, 106.7],   // Ho Chi Minh City
  // South Asia
  [19.0, 72.8],    // Mumbai/Nhava Sheva
  [13.1, 80.3],    // Chennai
  [6.9, 79.9],     // Colombo
  // Middle East
  [25.0, 55.1],    // Jebel Ali/Dubai
  [26.2, 50.5],    // Dammam
  [21.5, 39.2],    // Jeddah
  [29.4, 47.9],    // Shuwaikh/Kuwait
  // Europe
  [51.9, 4.5],     // Rotterdam
  [51.2, 4.4],     // Antwerp
  [53.5, 9.9],     // Hamburg
  [51.9, 1.3],     // Felixstowe
  [36.1, -5.4],    // Algeciras
  [39.5, -0.3],    // Valencia
  [37.9, 23.6],    // Piraeus
  [45.4, 12.3],    // Venice
  [44.4, 8.9],     // Genoa
  [43.3, 5.4],     // Marseille
  [41.4, 2.2],     // Barcelona
  [38.7, -9.1],    // Lisbon
  [57.7, 11.9],    // Gothenburg
  [59.9, 10.7],    // Oslo
  // Africa
  [-34.0, 18.4],   // Cape Town
  [-29.9, 31.0],   // Durban
  [33.9, -6.8],    // Tangier Med
  [31.2, 32.3],    // Port Said
  [30.0, 32.6],    // Suez
  [-4.0, 39.7],    // Mombasa
  [6.4, 3.4],      // Lagos/Apapa
  // North America
  [33.7, -118.3],  // Los Angeles/Long Beach
  [40.7, -74.0],   // New York/Newark
  [32.1, -81.1],   // Savannah
  [29.7, -95.0],   // Houston
  [47.6, -122.3],  // Seattle/Tacoma
  [49.3, -123.1],  // Vancouver
  [25.8, -80.2],   // Miami
  [9.4, -79.9],    // Panama (Atlantic side)
  // South America
  [-23.9, -46.3],  // Santos
  [-34.6, -58.4],  // Buenos Aires
  [10.5, -67.0],   // Puerto Cabello
  [-12.0, -77.1],  // Callao/Lima
  [-33.0, -71.6],  // Valparaiso
  [-5.8, -35.2],   // Natal
  // Oceania
  [-33.9, 151.2],  // Sydney
  [-37.8, 144.9],  // Melbourne
  [-32.0, 115.7],  // Fremantle/Perth
  [-36.8, 174.8],  // Auckland
]
