import { Customer, type CustomerDoc } from "@lift/shared";

/**
 * Look up a customer by id, falling back to the merge trail: a customer
 * merged into another one is deleted, but the survivor keeps its id in
 * `aliases[]`, so old links (texts, bookmarks, an RO opened in another tab)
 * still land on the right record.
 *
 * `redirectedFrom` is set when the id was an alias — callers pass it back so
 * the UI can swap the URL for the survivor's.
 */
export async function resolveCustomerByIdOrAlias(
  shopId: string,
  id: string
): Promise<{ customer: CustomerDoc; redirectedFrom: string | null } | null> {
  const direct = await Customer.findOne({ _id: id, shopId }).lean<CustomerDoc>();
  if (direct) return { customer: direct, redirectedFrom: null };

  const survivor = await Customer.findOne({ shopId, "aliases.customerId": id }).lean<CustomerDoc>();
  if (survivor) return { customer: survivor, redirectedFrom: id };

  return null;
}
