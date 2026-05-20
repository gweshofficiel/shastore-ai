import { BaseStoreTemplate, storeThemes } from "@/templates/store/base";
import type { StorefrontData } from "@/types/storefront";

export function CleanScandinavianStoreTemplate({ store }: { store: StorefrontData }) {
  return <BaseStoreTemplate store={store} theme={storeThemes["clean-scandinavian"]} />;
}
