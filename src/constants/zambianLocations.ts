// Zambian provinces and cities/towns for loan product location restrictions

export const ZAMBIAN_PROVINCES = [
  "Lusaka Province",
  "Copperbelt Province", 
  "Southern Province",
  "Eastern Province",
  "Northern Province",
  "Luapula Province",
  "North-Western Province",
  "Western Province",
  "Central Province",
  "Muchinga Province",
] as const;

export const ZAMBIAN_CITIES = [
  // Lusaka Province
  "Lusaka",
  "Kafue",
  "Chongwe",
  "Chilanga",
  "Luangwa",
  
  // Copperbelt Province
  "Ndola",
  "Kitwe",
  "Chingola",
  "Mufulira",
  "Luanshya",
  "Chililabombwe",
  "Kalulushi",
  "Mpongwe",
  
  // Southern Province
  "Livingstone",
  "Choma",
  "Mazabuka",
  "Monze",
  "Kalomo",
  "Kazungula",
  "Sinazongwe",
  "Namwala",
  
  // Eastern Province
  "Chipata",
  "Katete",
  "Petauke",
  "Lundazi",
  "Chadiza",
  "Nyimba",
  "Mambwe",
  
  // Northern Province
  "Kasama",
  "Mbala",
  "Mpika",
  "Nakonde",
  "Isoka",
  "Chinsali",
  "Luwingu",
  "Mporokoso",
  
  // Luapula Province
  "Mansa",
  "Samfya",
  "Kawambwa",
  "Nchelenge",
  "Mwense",
  "Chembe",
  
  // North-Western Province
  "Solwezi",
  "Kasempa",
  "Mwinilunga",
  "Zambezi",
  "Kabompo",
  "Mufumbwe",
  
  // Western Province
  "Mongu",
  "Senanga",
  "Kaoma",
  "Sesheke",
  "Kalabo",
  "Shangombo",
  "Limulunga",
  
  // Central Province
  "Kabwe",
  "Kapiri Mposhi",
  "Mkushi",
  "Mumbwa",
  "Serenje",
  "Chibombo",
  "Chisamba",
  "Itezhi-Tezhi",
  
  // Muchinga Province
  "Chinsali",
  "Isoka",
  "Nakonde",
  "Shiwang'andu",
  "Mafinga",
  "Mpika",
] as const;

// Combined list with provinces for broader restrictions
export const ZAMBIAN_LOCATIONS = [
  // "Nationwide" option first
  { value: "nationwide", label: "Nationwide (All Locations)", type: "special" as const },
  
  // Provinces
  ...ZAMBIAN_PROVINCES.map(p => ({ value: p.toLowerCase().replace(" ", "_"), label: p, type: "province" as const })),
  
  // Cities
  ...ZAMBIAN_CITIES.map(c => ({ value: c.toLowerCase(), label: c, type: "city" as const })),
];

// Just the city names for simple dropdown
export const ZAMBIAN_CITIES_LIST = [
  "Lusaka",
  "Ndola", 
  "Kitwe",
  "Livingstone",
  "Kabwe",
  "Chingola",
  "Mufulira",
  "Luanshya",
  "Chipata",
  "Kasama",
  "Solwezi",
  "Mongu",
  "Mansa",
  "Choma",
  "Mazabuka",
  "Kafue",
  "Chongwe",
  "Kalulushi",
  "Mpika",
  "Nakonde",
  "Petauke",
  "Mbala",
  "Kapiri Mposhi",
  "Mkushi",
  "Mumbwa",
  "Monze",
  "Kalomo",
  "Chililabombwe",
];

export type ZambianCity = typeof ZAMBIAN_CITIES_LIST[number];
