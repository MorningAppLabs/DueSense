import { Feather } from "@expo/vector-icons";
import type { Category } from "../types/types";

/**
 * Shared category → Feather icon map.
 * Keys are UPPERCASE for case-insensitive lookup of built-in categories.
 * Used as the auto-map fallback when no user-stored icon is found.
 */
export const CATEGORY_ICON_MAP: Record<string, keyof typeof Feather.glyphMap> = {
  // ── Food & Dining ──────────────────────────────────────
  FOOD:         "coffee",
  DINING:       "coffee",
  RESTAURANT:   "coffee",
  CAFE:         "coffee",
  CANTEEN:      "coffee",
  BAKERY:       "coffee",
  SWIGGY:       "coffee",
  ZOMATO:       "coffee",

  // ── Groceries ─────────────────────────────────────────
  GROCERY:      "shopping-cart",
  GROCERIES:    "shopping-cart",
  SUPERMARKET:  "shopping-cart",
  KIRANA:       "shopping-cart",

  // ── Travel & Transport ────────────────────────────────
  TRAVEL:       "map-pin",
  TRANSPORT:    "map-pin",
  TAXI:         "map-pin",
  UBER:         "map-pin",
  OLA:          "map-pin",
  RAPIDO:       "map-pin",
  FLIGHT:       "send",
  HOTEL:        "home",
  TRAIN:        "navigation",
  BUS:          "navigation",
  METRO:        "navigation",

  // ── Fuel ──────────────────────────────────────────────
  FUEL:         "zap",
  PETROL:       "zap",
  CNG:          "zap",

  // ── Shopping & Fashion ────────────────────────────────
  SHOPPING:     "shopping-bag",
  FASHION:      "shopping-bag",
  CLOTHES:      "shopping-bag",
  APPAREL:      "shopping-bag",
  ELECTRONICS:  "monitor",
  GADGETS:      "monitor",
  AMAZON:       "shopping-bag",
  FLIPKART:     "shopping-bag",
  MYNTRA:       "shopping-bag",

  // ── Entertainment ─────────────────────────────────────
  ENTERTAINMENT: "film",
  MOVIES:       "film",
  MUSIC:        "music",
  GAMING:       "target",
  GAMES:        "target",
  SPORTS:       "activity",
  GYM:          "activity",
  NETFLIX:      "tv",
  SPOTIFY:      "music",
  HOTSTAR:      "tv",
  OTT:          "tv",

  // ── Bills & Utilities ─────────────────────────────────
  BILLS:        "file-text",
  UTILITIES:    "home",
  ELECTRICITY:  "zap",
  WATER:        "droplet",
  GAS:          "wind",
  INTERNET:     "wifi",
  BROADBAND:    "wifi",
  PHONE:        "phone",
  MOBILE:       "smartphone",
  DTH:          "tv",

  // ── Health & Fitness ──────────────────────────────────
  HEALTH:       "heart",
  MEDICAL:      "heart",
  HOSPITAL:     "plus-circle",
  PHARMACY:     "plus-circle",
  DOCTOR:       "plus-circle",
  FITNESS:      "activity",
  YOGA:         "activity",

  // ── Education ─────────────────────────────────────────
  EDUCATION:    "book-open",
  BOOKS:        "book",
  COURSES:      "book-open",
  SCHOOL:       "book-open",
  COLLEGE:      "book-open",
  TUITION:      "book-open",

  // ── Subscriptions ─────────────────────────────────────
  SUBSCRIPTIONS: "refresh-cw",
  SUBSCRIPTION: "refresh-cw",
  STREAMING:    "play-circle",

  // ── Finance & Investments ─────────────────────────────
  INVESTMENT:   "trending-up",
  INVESTMENTS:  "trending-up",
  SAVINGS:      "database",
  INSURANCE:    "shield",
  EMI:          "calendar",
  LOAN:         "dollar-sign",
  CREDIT:       "credit-card",

  // ── Social & Lifestyle ────────────────────────────────
  GIFTS:        "gift",
  GIFT:         "gift",
  DONATION:     "heart",

  // ── Others / Fallback ─────────────────────────────────
  OTHERS:       "tag",
  OTHER:        "tag",
  MISCELLANEOUS: "more-horizontal",
  MISC:         "more-horizontal",
};

// ─────────────────────────────────────────────────────────
// Icon Picker: curated set of Feather icons for categories
// Each entry has a machine name and a human label shown in the picker.
// ─────────────────────────────────────────────────────────
export const ICON_PICKER_OPTIONS: { icon: keyof typeof Feather.glyphMap; label: string }[] = [
  { icon: "coffee",        label: "Food"        },
  { icon: "shopping-cart", label: "Grocery"     },
  { icon: "shopping-bag",  label: "Shopping"    },
  { icon: "map-pin",       label: "Travel"      },
  { icon: "zap",           label: "Fuel"        },
  { icon: "film",          label: "Movies"      },
  { icon: "music",         label: "Music"       },
  { icon: "tv",            label: "OTT/TV"      },
  { icon: "activity",      label: "Fitness"     },
  { icon: "heart",         label: "Health"      },
  { icon: "plus-circle",   label: "Medical"     },
  { icon: "book-open",     label: "Education"   },
  { icon: "book",          label: "Books"       },
  { icon: "file-text",     label: "Bills"       },
  { icon: "wifi",          label: "Internet"    },
  { icon: "smartphone",    label: "Mobile"      },
  { icon: "phone",         label: "Phone"       },
  { icon: "home",          label: "Home"        },
  { icon: "droplet",       label: "Water"       },
  { icon: "wind",          label: "Gas"         },
  { icon: "trending-up",   label: "Investment"  },
  { icon: "shield",        label: "Insurance"   },
  { icon: "refresh-cw",    label: "Subscription"},
  { icon: "play-circle",   label: "Streaming"   },
  { icon: "gift",          label: "Gifts"       },
  { icon: "target",        label: "Gaming"      },
  { icon: "monitor",       label: "Electronics" },
  { icon: "calendar",      label: "EMI"         },
  { icon: "dollar-sign",   label: "Finance"     },
  { icon: "database",      label: "Savings"     },
  { icon: "briefcase",     label: "Work"        },
  { icon: "umbrella",      label: "Misc"        },
  { icon: "send",          label: "Flight"      },
  { icon: "navigation",    label: "Transit"     },
  { icon: "tag",           label: "Other"       },
];

// ─────────────────────────────────────────────────────────
// Resolvers
// ─────────────────────────────────────────────────────────

/**
 * Returns the Feather icon name for a category, checking user-stored custom
 * categories first, then falling back to the built-in CATEGORY_ICON_MAP.
 * Case-insensitive. Falls back to "tag" for unknown categories.
 *
 * @param name           - the category name string (e.g. transaction.category)
 * @param storeCategories - the `categories` array from the Zustand store
 */
export const getCategoryIconFull = (
  name: string,
  storeCategories: Category[]
): keyof typeof Feather.glyphMap => {
  if (!name) return "tag";
  const stored = storeCategories.find(
    (c) => c.name.toLowerCase() === name.toLowerCase()
  );
  if (stored) return stored.icon as keyof typeof Feather.glyphMap;
  return CATEGORY_ICON_MAP[name.toUpperCase().trim()] ?? "tag";
};

/**
 * Returns the Feather icon name using only the built-in map (no store access).
 * Use `getCategoryIconFull` when you have store access.
 */
export const getCategoryIcon = (category: string): keyof typeof Feather.glyphMap =>
  CATEGORY_ICON_MAP[category?.toUpperCase()?.trim()] ?? "tag";

/**
 * Built-in default categories with their pre-set icons.
 * These are always present and never stored in the Zustand store.
 */
export const DEFAULT_CATEGORIES: Category[] = [
  { name: "Food",          icon: "coffee"        },
  { name: "Travel",        icon: "map-pin"       },
  { name: "Fuel",          icon: "zap"           },
  { name: "Shopping",      icon: "shopping-bag"  },
  { name: "Entertainment", icon: "film"          },
  { name: "Bills",         icon: "file-text"     },
  { name: "Health",        icon: "heart"         },
  { name: "Education",     icon: "book-open"     },
  { name: "Grocery",       icon: "shopping-cart" },
  { name: "Others",        icon: "tag"           },
];
