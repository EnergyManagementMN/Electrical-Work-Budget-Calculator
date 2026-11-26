/**
 * EDIT THIS FILE to set your business details and local default prices.
 * Every default below is an EXAMPLE — replace it with real Mongolian figures
 * from current tariffs and supplier quotes before you publish the app.
 */
export const CONTACT = {
  businessName: "[Компанийн нэр]",
  facebookUrl: "https://facebook.com/",   // your Facebook page or m.me/<page> Messenger link
  phone: "[Утасны дугаар]",
  email: "[И-мэйл]"
};

export const DEFAULTS = {
  electricityPrice: 200,       // ₮/kWh — EXAMPLE, use your client's tariff
  coalPrice: 150000,           // ₮/tonne — EXAMPLE
  demandCharge: 0,             // ₮/kW per month — 0 if the tariff has no demand charge
  discountRate: 12,            // %/year
  motorCostPerKW: 200000,      // ₮ per kW of premium motor — EXAMPLE
  ledCostEach: 45000,          // ₮ per LED fitting installed — EXAMPLE
  vfdCostPerKW: 320000         // ₮ per kW of drive, installed — EXAMPLE
};
