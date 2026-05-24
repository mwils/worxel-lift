import { LINE_ITEM_KINDS } from "../constants.js";

export const STARTER_DEFAULT_LABOR_RATE_CENTS = 13500; // $135/hr placeholder

export interface StarterTemplateLineItem {
  kind: (typeof LINE_ITEM_KINDS)[number];
  description: string;
  hours?: number;
  rate?: number;
  qty?: number;
  unitPrice?: number;
}

export interface StarterTemplate {
  starterKey: string;
  name: string;
  category: string;
  lineItems: StarterTemplateLineItem[];
}

const r = STARTER_DEFAULT_LABOR_RATE_CENTS;

export const STARTER_TEMPLATES: readonly StarterTemplate[] = [
  {
    starterKey: "oil_change_synthetic",
    name: "Oil change — full synthetic",
    category: "Maintenance",
    lineItems: [
      { kind: "labor", description: "Drain & fill oil, replace filter", hours: 0.5, rate: r },
      { kind: "part", description: "Full synthetic motor oil (5qt)", qty: 5, unitPrice: 950 },
      { kind: "part", description: "Oil filter", qty: 1, unitPrice: 1200 },
      { kind: "fee", description: "Shop supplies & disposal", unitPrice: 500 },
    ],
  },
  {
    starterKey: "oil_change_conventional",
    name: "Oil change — conventional",
    category: "Maintenance",
    lineItems: [
      { kind: "labor", description: "Drain & fill oil, replace filter", hours: 0.5, rate: r },
      { kind: "part", description: "Conventional motor oil (5qt)", qty: 5, unitPrice: 450 },
      { kind: "part", description: "Oil filter", qty: 1, unitPrice: 900 },
      { kind: "fee", description: "Shop supplies & disposal", unitPrice: 500 },
    ],
  },
  {
    starterKey: "brake_pads_front",
    name: "Front brake pads",
    category: "Brakes",
    lineItems: [
      { kind: "labor", description: "R&R front brake pads, lubricate slides", hours: 1.2, rate: r },
      { kind: "part", description: "Front brake pad set", qty: 1, unitPrice: 6500 },
      { kind: "fee", description: "Shop supplies", unitPrice: 500 },
    ],
  },
  {
    starterKey: "brake_pads_rear",
    name: "Rear brake pads",
    category: "Brakes",
    lineItems: [
      { kind: "labor", description: "R&R rear brake pads, lubricate slides", hours: 1.2, rate: r },
      { kind: "part", description: "Rear brake pad set", qty: 1, unitPrice: 6000 },
      { kind: "fee", description: "Shop supplies", unitPrice: 500 },
    ],
  },
  {
    starterKey: "brake_rotors_pads_front",
    name: "Front rotors & pads",
    category: "Brakes",
    lineItems: [
      { kind: "labor", description: "R&R front rotors and pads", hours: 1.8, rate: r },
      { kind: "part", description: "Front brake pad set", qty: 1, unitPrice: 6500 },
      { kind: "part", description: "Front rotor", qty: 2, unitPrice: 5500 },
      { kind: "fee", description: "Shop supplies", unitPrice: 500 },
    ],
  },
  {
    starterKey: "ac_recharge_134a",
    name: "A/C recharge — R-134a",
    category: "HVAC",
    lineItems: [
      { kind: "labor", description: "Evacuate & recharge A/C system, leak check", hours: 1.0, rate: r },
      { kind: "part", description: "R-134a refrigerant", qty: 2, unitPrice: 2200 },
      { kind: "fee", description: "Refrigerant handling fee", unitPrice: 1500 },
    ],
  },
  {
    starterKey: "battery_replace",
    name: "Battery replacement",
    category: "Electrical",
    lineItems: [
      { kind: "labor", description: "R&R battery, test charging system", hours: 0.4, rate: r },
      { kind: "part", description: "Battery (group size varies)", qty: 1, unitPrice: 18000 },
      { kind: "fee", description: "Core / disposal", unitPrice: 1500 },
    ],
  },
  {
    starterKey: "alternator_rr",
    name: "Alternator R&R",
    category: "Electrical",
    lineItems: [
      { kind: "labor", description: "R&R alternator, test charging system", hours: 1.5, rate: r },
      { kind: "part", description: "Alternator", qty: 1, unitPrice: 24000 },
      { kind: "fee", description: "Shop supplies", unitPrice: 500 },
    ],
  },
  {
    starterKey: "tire_rotation_balance",
    name: "Tire rotation & balance",
    category: "Tires",
    lineItems: [
      { kind: "labor", description: "Rotate & balance 4 tires", hours: 0.6, rate: r },
      { kind: "fee", description: "Wheel weights & supplies", unitPrice: 400 },
    ],
  },
  {
    starterKey: "coolant_flush",
    name: "Coolant flush",
    category: "Maintenance",
    lineItems: [
      { kind: "labor", description: "Drain, flush, and refill cooling system", hours: 1.0, rate: r },
      { kind: "part", description: "Coolant (gallon)", qty: 2, unitPrice: 2200 },
      { kind: "fee", description: "Shop supplies & disposal", unitPrice: 500 },
    ],
  },
  {
    starterKey: "serpentine_belt",
    name: "Serpentine belt",
    category: "Maintenance",
    lineItems: [
      { kind: "labor", description: "R&R serpentine belt, inspect tensioner & idlers", hours: 0.8, rate: r },
      { kind: "part", description: "Serpentine belt", qty: 1, unitPrice: 4500 },
    ],
  },
  {
    starterKey: "spark_plugs_4cyl",
    name: "Spark plugs — 4-cyl",
    category: "Maintenance",
    lineItems: [
      { kind: "labor", description: "R&R spark plugs (4-cyl), gap as required", hours: 0.7, rate: r },
      { kind: "part", description: "Spark plug", qty: 4, unitPrice: 850 },
      { kind: "fee", description: "Shop supplies", unitPrice: 300 },
    ],
  },
];
