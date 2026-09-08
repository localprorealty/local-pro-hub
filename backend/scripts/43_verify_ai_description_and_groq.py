import asyncio
import json
import io
import pypdf
from deps.auth import get_service_client
from config import get_settings
from routers.listings import generate_description, _build_description_context, DESCRIPTION_PROMPT
from routers.voice import extract_field, ExtractRequest
from routers.marketing_video import generate_script, GenerateScriptRequest
import groq

async def test_all():
    print("==================================================")
    print("STEP 1: VERIFY GROQ MODEL ACROSS CALL SITES")
    print("==================================================")
    settings = get_settings()
    print("Current settings.groq_model:", settings.groq_model)
    assert settings.groq_model == "openai/gpt-oss-120b"

    groq_client = groq.Groq(api_key=settings.require_groq())

    # --- Call Site 1: PDF LLM Parsing ---
    print("\n--- 1A: Test PDF LLM Parser with real text ---")
    text_path = "/Users/adarshsonu/.gemini/antigravity-ide/brain/cb713577-2f6e-4648-a52b-ac5940c21da3/scratch/extracted_pdf_text.txt"
    with open(text_path) as f:
        pdf_text = f.read()
    
    pdf_prompt = f"""You are an expert real estate data parser. Parse the following extracted text from a Realist Property Details PDF report and return a JSON object with the following keys. If a value is missing, N/A, or empty, set it to null.

Required Keys:
- street_number (string)
- street_name (string)
- city (string)
- state (string)
- zip_code (string)
- bedrooms_total (integer)
- bathrooms_full (integer)
- living_area_sqft (integer)
- year_built (integer)
- seller_name (string)

Extracted Report Text:
{pdf_text[:1200]}

Return ONLY the raw JSON object inside a code block.
"""
    pdf_resp = groq_client.chat.completions.create(
        model=settings.groq_model,
        messages=[{"role": "user", "content": pdf_prompt}],
        temperature=0.0
    )
    raw_pdf_out = pdf_resp.choices[0].message.content or ""
    print("PDF Parser Raw Output:")
    print(raw_pdf_out)
    clean_json = raw_pdf_out
    if "```json" in clean_json:
        clean_json = clean_json.split("```json")[1].split("```")[0].strip()
    elif "```" in clean_json:
        clean_json = clean_json.split("```")[1].split("```")[0].strip()
    parsed_pdf_dict = json.loads(clean_json)
    print("Parsed Keys Verified:", list(parsed_pdf_dict.keys()))

    # --- Call Site 2: Voice Extract ---
    print("\n--- 1B: Spot-check Voice Extract Live ---")
    voice_req = ExtractRequest(
        transcription="The home has four bedrooms and three full baths",
        field_key="bedrooms_total",
        field_label="Bedrooms Total",
        field_type="number",
        options=None,
    )
    voice_result = await extract_field(voice_req)
    print("Voice Extract Result:", voice_result)
    assert voice_result["value"] == "4" or voice_result["value"] == 4
    print("Voice Extract CONFIRMED working live!")

    # --- Call Site 3: Marketing Video Script ---
    print("\n--- 1C: Spot-check Marketing Script Generation Live ---")
    script_req = GenerateScriptRequest(
        topic="3 reasons to sell your home this fall",
        audience="First-time sellers in DFW",
        content_style="engaging",
        tone="professional",
        pacing="medium",
        cta="DM me for a free market valuation",
        agent_name="Andrew Wetzel",
    )
    script_result = await generate_script(script_req, _agent_id="d2603037-0f9f-46bd-905e-4b9b9de3d35a")
    print("Marketing Script Result Keys:", list(script_result.keys()))
    print("Script Title:", script_result.get("title"))
    print("Script Hook:", script_result.get("hook"))
    print("Script Duration seconds:", script_result.get("estimated_duration_seconds"))
    print("Marketing Script CONFIRMED working live!")

    print("\n==================================================")
    print("STEP 2 & 3: DESCRIPTION GENERATION & PERSISTENCE")
    print("==================================================")
    sb = get_service_client()
    agent_id = "d2603037-0f9f-46bd-905e-4b9b9de3d35a"

    # Create a fresh draft listing to test end-to-end at draft stage
    create_res = sb.table("listings").insert({
        "agent_id": agent_id,
        "listing_type": "listing",
        "stage": "draft",
        "address_full": "456 Oak Hollow Way, Flower Mound, TX, 75028",
        "form_data": {
            "property_sub_type": "Single Family Residence",
            "street_number": "456",
            "street_name": "Oak Hollow",
            "street_type": "Way",
            "city": "Flower Mound",
            "state": "TX",
            "zip_code": "75028",
            "bedrooms_total": 3,
            "bathrooms_full": 2,
            "living_area_sqft": 2200,
            "list_price": 550000,
            "school_district": "Lewisville ISD",
            "cooling": ["Central Air"],
            "heating": ["Central"]
        }
    }).execute()
    test_listing = create_res.data[0]
    test_id = test_listing["id"]
    print(f"Created fresh test listing at 'draft' stage: {test_id}")
    print("Initial description_generated:", repr(test_listing.get("description_generated")))

    try:
        # Generate description at draft stage
        print("\nTriggering generate_description on draft listing...")
        gen1 = await generate_description(test_id, agent_id)
        print("Generated Description 1 (Length:", gen1["char_count"], "):")
        print(gen1["description"])

        # Query Supabase to confirm persistence
        row1 = sb.table("listings").select("id, stage, description_generated, form_data").eq("id", test_id).single().execute().data
        print("\nSupabase row after 1st generation:")
        print("Stage:", row1["stage"])
        print("DB description_generated:\n", row1["description_generated"])
        assert row1["description_generated"] == gen1["description"]
        assert (row1["form_data"] or {}).get("property_description") == gen1["description"]
        print("CONFIRMED: Initial description successfully persisted to Supabase at 'draft' stage!")

        print("\n==================================================")
        print("STEP 4: GENERATE → REGENERATE FLOW")
        print("==================================================")
        print("Simulating agent editing form fields in UI: updating to 4 bedrooms and pool_yn=Yes...")
        updated_fd = row1["form_data"]
        updated_fd["bedrooms_total"] = 4
        updated_fd["pool_yn"] = "Yes"
        updated_fd["pool_features"] = ["In Ground", "Gunite"]
        sb.table("listings").update({"form_data": updated_fd}).eq("id", test_id).execute()

        print("Clicking Regenerate...")
        gen2 = await generate_description(test_id, agent_id)
        print("Generated Description 2 (Length:", gen2["char_count"], "):")
        print(gen2["description"])

        row2 = sb.table("listings").select("id, stage, description_generated, form_data").eq("id", test_id).single().execute().data
        print("\nSupabase row after Regenerate:")
        print("DB description_generated:\n", row2["description_generated"])
        assert row2["description_generated"] == gen2["description"]
        assert "4" in gen2["description"] or "four" in gen2["description"].lower() or "pool" in gen2["description"].lower()
        assert gen1["description"] != gen2["description"], "Regenerated description should reflect updated property details!"
        print("CONFIRMED: Regenerate overwritten in Supabase and reflects new bedroom/pool details!")

    finally:
        # Clean up test listing
        sb.table("listings").delete().eq("id", test_id).execute()
        print(f"\nCleaned up test listing {test_id}.")

if __name__ == "__main__":
    asyncio.run(test_all())
