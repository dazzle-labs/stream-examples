// Major world cities — [latitude, longitude, relative size (0–1)]
// Size roughly tracks metro population; used for city-light brightness on night side

export const cities: readonly (readonly [number, number, number])[] = [
  // East Asia
  [35.7, 139.7, 1.0],    // Tokyo
  [31.2, 121.5, 0.9],    // Shanghai
  [39.9, 116.4, 0.85],   // Beijing
  [37.6, 127.0, 0.8],    // Seoul
  [23.1, 113.3, 0.75],   // Guangzhou
  [22.5, 114.1, 0.6],    // Shenzhen
  [34.7, 135.5, 0.7],    // Osaka
  [22.3, 114.2, 0.55],   // Hong Kong
  [30.6, 104.1, 0.65],   // Chengdu
  [29.6, 106.5, 0.6],    // Chongqing
  [23.0, 113.1, 0.5],    // Dongguan
  [39.1, 117.2, 0.55],   // Tianjin
  [30.3, 120.2, 0.5],    // Hangzhou
  [32.1, 118.8, 0.5],    // Nanjing
  [34.3, 108.9, 0.45],   // Xi'an
  [25.0, 102.7, 0.4],    // Kunming
  [43.8, 125.3, 0.35],   // Changchun
  // Southeast Asia
  [1.3, 103.8, 0.5],     // Singapore
  [13.8, 100.5, 0.6],    // Bangkok
  [14.6, 121.0, 0.65],   // Manila
  [-6.2, 106.8, 0.7],    // Jakarta
  [21.0, 105.9, 0.5],    // Hanoi
  [10.8, 106.7, 0.55],   // Ho Chi Minh City
  [3.1, 101.7, 0.5],     // Kuala Lumpur
  [16.9, 96.2, 0.4],     // Yangon
  // South Asia
  [19.1, 72.9, 0.9],     // Mumbai
  [28.6, 77.2, 0.85],    // Delhi
  [23.8, 90.4, 0.7],     // Dhaka
  [24.9, 67.1, 0.65],    // Karachi
  [13.1, 80.3, 0.5],     // Chennai
  [12.9, 77.6, 0.55],    // Bangalore
  [22.6, 88.4, 0.6],     // Kolkata
  [17.4, 78.5, 0.5],     // Hyderabad
  [26.9, 75.8, 0.35],    // Jaipur
  [6.9, 79.9, 0.3],      // Colombo
  [27.7, 85.3, 0.35],    // Kathmandu
  // Middle East
  [25.2, 55.3, 0.5],     // Dubai
  [41.0, 29.0, 0.6],     // Istanbul
  [24.7, 46.7, 0.45],    // Riyadh
  [35.7, 51.4, 0.55],    // Tehran
  [33.3, 44.4, 0.45],    // Baghdad
  [32.1, 36.2, 0.25],    // Amman
  [33.9, 35.5, 0.2],     // Beirut
  [31.9, 35.2, 0.3],     // Jerusalem
  // Europe
  [51.5, -0.1, 0.7],     // London
  [48.9, 2.3, 0.65],     // Paris
  [55.8, 37.6, 0.7],     // Moscow
  [40.4, -3.7, 0.5],     // Madrid
  [41.4, 2.2, 0.45],     // Barcelona
  [52.5, 13.4, 0.45],    // Berlin
  [41.9, 12.5, 0.4],     // Rome
  [59.9, 30.3, 0.4],     // St Petersburg
  [50.1, 14.4, 0.25],    // Prague
  [47.5, 19.1, 0.25],    // Budapest
  [52.2, 21.0, 0.3],     // Warsaw
  [48.2, 16.4, 0.25],    // Vienna
  [52.4, 4.9, 0.3],      // Amsterdam
  [45.5, 9.2, 0.35],     // Milan
  [38.7, -9.1, 0.3],     // Lisbon
  [37.9, 23.7, 0.3],     // Athens
  [59.3, 18.1, 0.25],    // Stockholm
  [55.7, 12.6, 0.2],     // Copenhagen
  [60.2, 24.9, 0.2],     // Helsinki
  [53.3, -6.3, 0.2],     // Dublin
  [46.2, 6.1, 0.2],      // Geneva
  [47.4, 8.5, 0.25],     // Zurich
  // Africa
  [30.0, 31.2, 0.7],     // Cairo
  [6.5, 3.4, 0.65],      // Lagos
  [-1.3, 36.8, 0.4],     // Nairobi
  [-26.2, 28.0, 0.45],   // Johannesburg
  [33.6, -7.6, 0.4],     // Casablanca
  [9.0, 38.7, 0.35],     // Addis Ababa
  [-33.9, 18.4, 0.3],    // Cape Town
  [5.6, -0.2, 0.3],      // Accra
  [14.7, -17.5, 0.3],    // Dakar
  [-4.3, 15.3, 0.35],    // Kinshasa
  [36.8, 10.2, 0.2],     // Tunis
  [0.3, 32.6, 0.25],     // Kampala
  [-6.8, 39.3, 0.3],     // Dar es Salaam
  // North America
  [40.7, -74.0, 0.8],    // New York
  [34.1, -118.2, 0.7],   // Los Angeles
  [41.9, -87.6, 0.6],    // Chicago
  [29.8, -95.4, 0.55],   // Houston
  [33.4, -112.1, 0.4],   // Phoenix
  [25.8, -80.2, 0.45],   // Miami
  [39.7, -105.0, 0.35],  // Denver
  [47.6, -122.3, 0.35],  // Seattle
  [37.8, -122.4, 0.4],   // San Francisco
  [33.8, -84.4, 0.4],    // Atlanta
  [43.7, -79.4, 0.5],    // Toronto
  [45.5, -73.6, 0.35],   // Montreal
  [49.3, -123.1, 0.3],   // Vancouver
  [19.4, -99.1, 0.8],    // Mexico City
  [20.7, -103.3, 0.35],  // Guadalajara
  [25.7, -100.3, 0.35],  // Monterrey
  [23.1, -82.4, 0.3],    // Havana
  [18.5, -69.9, 0.25],   // Santo Domingo
  // South America
  [-23.6, -46.6, 0.8],   // São Paulo
  [-22.9, -43.2, 0.55],  // Rio de Janeiro
  [-34.6, -58.4, 0.6],   // Buenos Aires
  [4.6, -74.1, 0.5],     // Bogotá
  [-12.0, -77.0, 0.5],   // Lima
  [-33.4, -70.7, 0.45],  // Santiago
  [10.5, -66.9, 0.35],   // Caracas
  [-15.8, -48.0, 0.35],  // Brasília
  [-3.1, -60.0, 0.25],   // Manaus
  [-0.2, -78.5, 0.25],   // Quito
  [-1.8, -79.5, 0.25],   // Guayaquil
  [-30.0, -51.2, 0.3],   // Porto Alegre
  [-25.3, -49.3, 0.3],   // Curitiba
  // Oceania
  [-33.9, 151.2, 0.45],  // Sydney
  [-37.8, 144.9, 0.4],   // Melbourne
  [-27.5, 153.0, 0.3],   // Brisbane
  [-31.9, 115.9, 0.25],  // Perth
  [-36.8, 174.8, 0.2],   // Auckland
]
