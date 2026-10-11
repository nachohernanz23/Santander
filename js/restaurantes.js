// Restaurantes calidad-precio: nota de Google ≥ 4 y precio medio ≤ 40 €/persona.
// Datos de Google Maps consultados el 11-oct-2026. Los que añadáis desde la web se guardan en el servidor.

const ZONAS_R = {
  santander: "Santander", costa: "Costa occidental", soplao: "El Soplao y Nansa", liebana: "Liébana y Picos",
  oriente: "Santoña, Laredo y Castro", interior: "Valles del interior", euskadi: "Bermeo y Bilbao"
};

// Zonas donde se come cada día según el plan
const DIA_ZONAS = {
  lun: ["costa"], mar: ["oriente", "santander"], mie: ["liebana"], jue: ["euskadi"],
  vie: ["soplao", "interior"], sab: ["interior"], dom: ["interior", "santander"]
};

const RESTAURANTES = {};
