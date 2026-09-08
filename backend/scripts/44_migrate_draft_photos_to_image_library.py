"""
Migration & backfill script:
Reads existing photos in marketing_drafts, copies the image files
from 'marketing-drafts' (private) to 'listing-images' (public),
and inserts records into 'listing_images'.
"""
import os
import sys
import uuid
from dotenv import load_dotenv

load_dotenv("backend/.env")
sys.path.insert(0, "backend")
from deps.auth import get_service_client


def main():
    client = get_service_client()

    print("Fetching existing marketing drafts...")
    res = client.table("marketing_drafts").select("id, listing_id, agent_id, state").execute()
    drafts = res.data or []
    print(f"Found {len(drafts)} drafts.")

    total_expected = sum(len(d.get("state", {}).get("photos", [])) for d in drafts)
    print(f"Total expected photos across all drafts: {total_expected}")

    total_migrated = 0
    for draft in drafts:
        listing_id = draft.get("listing_id")
        agent_id = draft.get("agent_id")
        state = draft.get("state") or {}
        photos = state.get("photos") or []

        print(f"\nProcessing listing {listing_id} ({len(photos)} photos)...")
        for idx, photo in enumerate(photos):
            photo_path = photo.get("photo_path")
            if not photo_path:
                print(f"  Skipping photo {idx + 1}: no photo_path")
                continue

            category = photo.get("category") or "other"
            is_hero = (category == "hero" or photo.get("is_hero") is True)
            image_type = "headshot" if category == "agent_headshot" else "gallery"

            # 1. Download file from private marketing-drafts bucket
            try:
                file_bytes = client.storage.from_("marketing-drafts").download(photo_path)
            except Exception as e:
                print(f"  [ERROR] Failed to download {photo_path} from marketing-drafts: {e}")
                raise e

            # 2. Upload to public listing-images bucket
            new_storage_path = photo_path
            content_type = "image/jpeg"
            if photo_path.endswith(".webp"):
                content_type = "image/webp"
            elif photo_path.endswith(".png"):
                content_type = "image/png"

            try:
                client.storage.from_("listing-images").upload(
                    new_storage_path,
                    file_bytes,
                    {"content-type": content_type, "upsert": "true"}
                )
                public_url = client.storage.from_("listing-images").get_public_url(new_storage_path)
                print(f"  Storage: Copied {photo_path} -> listing-images public URL: {public_url}")
            except Exception as e:
                print(f"  [ERROR] Upload to listing-images failed: {e}")
                raise e

            # 3. Determine primary key ID (use draft photo UUID if valid, or generate new UUID)
            photo_id = photo.get("id")
            try:
                if photo_id:
                    uuid.UUID(str(photo_id))
                else:
                    photo_id = str(uuid.uuid4())
            except (ValueError, TypeError):
                photo_id = str(uuid.uuid4())

            record = {
                "id": photo_id,
                "listing_id": listing_id,
                "storage_path": new_storage_path,
                "public_url": public_url,
                "image_type": image_type,
                "category": category,
                "is_hero": is_hero,
                "sort_order": idx,
                "file_size_bytes": len(file_bytes),
                "mime_type": content_type,
                "uploaded_by": agent_id,
            }

            # 4. Insert or update DB record
            # Check if record already exists by storage_path or by id
            existing = (
                client.table("listing_images")
                .select("id")
                .eq("listing_id", listing_id)
                .eq("storage_path", new_storage_path)
                .execute()
            )

            if existing.data:
                target_id = existing.data[0]["id"]
                db_res = client.table("listing_images").update(record).eq("id", target_id).execute()
                print(f"  DB: Updated record for photo {idx + 1} (id={target_id})")
            else:
                # Target the primary key 'id' constraint for upsert/insert
                db_res = client.table("listing_images").upsert(record, on_conflict="id").execute()
                inserted_id = db_res.data[0]["id"] if db_res.data else photo_id
                print(f"  DB: Inserted record for photo {idx + 1} (id={inserted_id})")

            if not db_res.data:
                raise RuntimeError(f"Database insert returned no data for photo {idx + 1}: {db_res}")

            total_migrated += 1

    print(f"\nMigration complete. Migrated {total_migrated} of {total_expected} photos.")

    # 5. Final verification query against Supabase
    count_check = client.table("listing_images").select("id", count="exact").execute()
    print(f"Verification Query: public.listing_images currently contains {count_check.count} rows.")


if __name__ == "__main__":
    main()
