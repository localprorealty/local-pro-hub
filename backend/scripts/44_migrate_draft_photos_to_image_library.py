"""
Migration & backfill script:
Reads existing photos in marketing_drafts, copies the image files
from 'marketing-drafts' (private) to 'listing-images' (public),
and inserts records into 'listing_images'.
"""
import os
import sys
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
                continue

            category = photo.get("category") or "other"
            is_hero = (category == "hero" or photo.get("is_hero") is True)
            image_type = "headshot" if category == "agent_headshot" else "gallery"

            # Check if file exists in marketing-drafts
            try:
                file_bytes = client.storage.from_("marketing-drafts").download(photo_path)
            except Exception as e:
                print(f"  Failed to download {photo_path} from marketing-drafts: {e}")
                continue

            # Upload to listing-images bucket
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
                print(f"  Copied {photo_path} -> listing-images public URL: {public_url}")
            except Exception as e:
                print(f"  Upload to listing-images warning: {e}")
                public_url = client.storage.from_("listing-images").get_public_url(new_storage_path)

            # Insert into listing_images if table exists
            record = {
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

            try:
                client.table("listing_images").upsert(record, on_conflict="listing_id,storage_path").execute()
                print(f"  Inserted DB record for photo {idx + 1}")
                total_migrated += 1
            except Exception as e:
                print(f"  DB insert warning (table may need migration SQL): {e}")

    print(f"\nFinished. Migrated {total_migrated} photos.")


if __name__ == "__main__":
    main()
