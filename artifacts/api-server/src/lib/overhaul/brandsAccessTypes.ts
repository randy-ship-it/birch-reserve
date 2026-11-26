/** Shared shapes for the /advertise/brands access-code payload. No hub data. */
export type BrandsAccessSurface = {
  key: string;
  label: string;
  views: number;
  priceUsd: number;
  priceCad: number;
  cpmUsd: number;
};

export type BrandsAccessHub = {
  key: string;
  name: string;
  kind: "brand" | "clinic";
  category: string;
  recovery?: string;
  audience?: string;
  bannerStatus?: string;
  logo?: string;
  banner?: string;
  url?: string;
  basis: string;
  surfaces: BrandsAccessSurface[];
  corePackageUsd: number;
  corePackageCad: number;
};

export type BrandsAccessPayload = {
  ok: true;
  token: string;
  claim: "Modelled estimates from listed partners";
  modelled: string;
  hubs: BrandsAccessHub[];
};
