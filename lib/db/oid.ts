import { ObjectId } from "mongodb";

/** Parse a hex string into an ObjectId, or null if it's not a valid id. */
export function toObjectId(id: string): ObjectId | null {
  if (!id || !ObjectId.isValid(id)) return null;
  return new ObjectId(id);
}
