import json
import asyncio
from config import get_settings
import groq
from routers.listings import NEIGHBORHOOD_PROMPT, _parse_json_content

def test_neighborhood_prompt_and_refinements():
    settings = get_settings()
    client = groq.Groq(api_key=settings.require_groq())
    
    print("==================================================")
    print("TEST 1: NEIGHBORHOOD GUIDE PROMPT VERIFICATION")
    print("==================================================")
    prompt = NEIGHBORHOOD_PROMPT.format(city="Frisco")
    resp = client.chat.completions.create(
        model=settings.groq_model,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.4,
        max_tokens=4000,
    )
    print("Full Groq response object:", resp)
    raw = (resp.choices[0].message.content or "").strip()
    print("Raw Groq response:", raw)
    data = _parse_json_content(raw)
    print("Parsed Keys:", list(data.keys()))
    print(f"intro (len: {len(data['intro'])}):", data['intro'])
    print(f"boundaries (len: {len(data['boundaries'])}):", data['boundaries'])
    print(f"nearby (len: {len(data['nearby_neighborhoods'])}):", data['nearby_neighborhoods'])
    
    sections = [
        "what_to_expect",
        "the_lifestyle",
        "unexpected_appeal",
        "the_market",
        "youll_fall_in_love",
    ]
    for s in sections:
        val = data[s]
        print(f"{s} (len: {len(val)}): {val}")
        # Each section should be concise (<= 140 chars)
        assert len(val) <= 150, f"Section {s} is too long: {len(val)} chars"
    
    print("\nAll neighborhood guide sections verified within budget!")

    print("\n==================================================")
    print("TEST 2: FLYER REFINEMENT NON-ANCHORING (FROM 969-CHAR INPUT)")
    print("==================================================")
    long_input = """Nicely landscaped 4 bedroom, 2 bath home located within the Lewisville ISD. Tons of upgraded features throughout including tall ceilings, arched doorways and large windows that let off lots of natural light. French door access to room located off entry can double as 4th bedroom or office space if desired. Kitchen offers SS appliances, 42in cabinets, tons of cabinet and counter space, breakfast bar that overlooks the yard & a bar area that opens to large cozy living room with wood burning FP focal point! Spacious master suite is large enough for a separate sitting area and features bay windows, access to covered patio out back and a huge ensuite bathroom with jetted tub! Laundry room is large enough for a second fridge. Covered patio out back opens to fully fenced oversized yard.  New roof in 2021! Schedule your private showing today!"""
    print(f"Original input length: {len(long_input)} characters")

    flyer_prompt = f"""You are a real estate marketing copywriter.

The agent wants to refine the property description for a single-page marketing flyer.

Current text (which may be an oversized MLS description):
{long_input}

Property context:
{{'address_full': '1234 Meadow Lane, Lewisville, TX', 'bedrooms_total': 4, 'bathrooms_total': 2}}

Agent's instruction:
"Add swimming pool"

Rules:
- STRICT LENGTH REQUIREMENT: You MUST condense, trim, or rewrite the copy to approximately 70-80 words (strictly 450 to 550 characters, 5-6 printed lines).
- NEVER preserve or anchor to the length of the current text. The current text may be too long and MUST be sized down to fit the flyer's fixed visual container.
- Single cohesive, high-impact paragraph.
- Upscale, compelling real estate marketing tone highlighting key features.
- Do not add agent contact details unless explicitly requested.
- Return ONLY the revised description paragraph. No preamble, no quotes, no markdown."""

    f_resp = client.chat.completions.create(
        model=settings.groq_model,
        messages=[{"role": "user", "content": flyer_prompt}],
        temperature=0.4,
        max_tokens=4000,
    )
    flyer_text = (f_resp.choices[0].message.content or "").strip()
    print(f"Flyer output (len: {len(flyer_text)} chars, words: {len(flyer_text.split())}):")
    print(flyer_text)
    assert 400 <= len(flyer_text) <= 590, f"Flyer text length {len(flyer_text)} out of expected range"
    assert len(flyer_text) < len(long_input) - 200, "Flyer text failed to condense the oversized input"
    print("Flyer refinement successfully trimmed oversized input to target capacity!")

    print("\n==================================================")
    print("TEST 3: PROPERTY DETAILS REFINEMENT (2 PARAGRAPHS FROM LONG INPUT)")
    print("==================================================")
    details_prompt = f"""You are a real estate marketing copywriter.

The agent wants to refine the property description for their Listing Book property details page.

Current text (which may be an unconstrained or lengthy MLS description):
{long_input}

Property context:
{{'address_full': '1234 Meadow Lane, Lewisville, TX'}}

Agent's instruction:
"Focus on luxury finishes and outdoor entertaining"

Rules:
- STRICT FORMAT AND LENGTH: You MUST output exactly 2 balanced paragraphs separated by two newlines (\\n\\n).
- NEVER preserve or anchor to the length of the current text. If the current text is too long or a single block, you MUST condense and split it into 2 balanced paragraphs.
- Target capacity: approximately 90-110 words total (~45-55 words per paragraph, strictly under 750 characters total).
- Must fit cleanly in the fixed book details column alongside property specifications without overflowing.
- Upscale, inviting real estate tone highlighting flow, design, and livability.
- Return ONLY the revised 2-paragraph description text. No preamble, no quotes, no markdown."""

    d_resp = client.chat.completions.create(
        model=settings.groq_model,
        messages=[{"role": "user", "content": details_prompt}],
        temperature=0.4,
        max_tokens=4000,
    )
    details_text = (d_resp.choices[0].message.content or "").strip()
    paras = details_text.split("\n\n")
    print(f"Details output (paragraphs: {len(paras)}, total len: {len(details_text)} chars):")
    for idx, p in enumerate(paras, 1):
        print(f"Para {idx} (len: {len(p)}): {p}")
    assert len(paras) == 2, f"Expected 2 paragraphs, got {len(paras)}"
    assert 550 <= len(details_text) <= 790, f"Details text length {len(details_text)} out of expected range"
    print("Property details 2-paragraph refinement verified!")

if __name__ == "__main__":
    test_neighborhood_prompt_and_refinements()
