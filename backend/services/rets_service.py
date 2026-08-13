"""NTREIS RETS session + property search (Matrix MLS)."""

from __future__ import annotations

import logging
import xml.etree.ElementTree as ET
from typing import Any
from urllib.parse import urlparse

import httpx

from config import Settings, get_settings

logger = logging.getLogger(__name__)

RETS_USER_AGENT = "LocalPROHub/1.0"
RETS_VERSION = "RETS/1.7.2"
RETS_PROPERTY_CLASS = "Property"

STATE_ABBREV = {
    "texas": "TX",
    "tx": "TX",
}


def _rets_base_url(login_url: str) -> str:
    parsed = urlparse(login_url)
    path = parsed.path.rsplit("/", 1)[0]
    return f"{parsed.scheme}://{parsed.netloc}{path}"


def _first(raw: dict[str, str], *keys: str) -> str:
    for key in keys:
        val = raw.get(key, "").strip()
        if val:
            return val
    return ""


def _split_list(raw: dict[str, str], *keys: str) -> list[str]:
    val = _first(raw, *keys)
    if not val:
        return []
    return [part.strip() for part in val.split(",") if part.strip()]


def _yn_to_yes_no(raw: dict[str, str], *keys: str) -> str:
    val = _first(raw, *keys).lower()
    if val in ("1", "true", "yes", "y"):
        return "Yes"
    if val in ("0", "false", "no", "n"):
        return "No"
    return _first(raw, *keys)


def _normalize_state(value: str) -> str:
    trimmed = value.strip()
    if len(trimmed) == 2:
        return trimmed.upper()
    return STATE_ABBREV.get(trimmed.lower(), trimmed)


def _strip_decimal_money(value: str) -> str:
    if not value:
        return ""
    if "." in value:
        return value.split(".", 1)[0]
    return value


def map_rets_to_address(raw: dict[str, str]) -> dict[str, str]:
    """Map RETS row → PropertyAddress keys (Step 0)."""
    mapped: dict[str, str] = {}
    if street_number := _first(raw, "StreetNumber", "StreetNumberNumeric"):
        mapped["street_number"] = street_number
    if street_name := _first(raw, "StreetName"):
        mapped["street_name"] = street_name
    if street_type := _first(raw, "StreetSuffix", "StreetDirSuffix"):
        mapped["street_type"] = street_type
    if city := _first(raw, "City"):
        mapped["city"] = city
    if state := _first(raw, "StateOrProvince"):
        mapped["state"] = _normalize_state(state)
    if zip_code := _first(raw, "PostalCode"):
        mapped["zip_code"] = zip_code[:5]
    if county := _first(raw, "CountyOrParish"):
        mapped["county"] = county
    if subdivision := _first(raw, "SubdivisionName"):
        mapped["subdivision"] = subdivision
    if mls_number := _first(raw, "ListingId", "ListingKeyNumeric"):
        mapped["mls_number"] = mls_number
    return mapped


def map_rets_to_form(raw: dict[str, str]) -> dict[str, Any]:
    """
    Map NTREIS RETS (RESO-style SystemNames) → flat NTREIS form_data keys.
    Field names verified via GET /rets/discover-fields (Class=Property).
    """
    mapped: dict[str, Any] = {}

    if v := _first(raw, "PropertySubType"):
        mapped["property_sub_type"] = v
    if v := _yn_to_yes_no(raw, "PropertyAttachedYN"):
        mapped["property_attached_yn"] = v
    if v := _first(raw, "ListingAgreement"):
        mapped["listing_agreement_type"] = v
    if v := _first(raw, "TransactionType"):
        mapped["transaction_type"] = v
    if v := _first(raw, "YearBuiltDetails"):
        mapped["year_built_status"] = v
    if v := _strip_decimal_money(_first(raw, "ListPrice")):
        mapped["list_price"] = v
    if v := _first(raw, "YearBuilt"):
        mapped["year_built"] = v
    if v := _first(raw, "LivingArea", "BuildingAreaTotal"):
        mapped["living_area_sqft"] = v.split(".", 1)[0] if "." in v else v
    if v := _first(raw, "ParcelNumber"):
        mapped["parcel_id"] = v
    if v := _first(raw, "StructuralStyle", "ArchitecturalStyle"):
        mapped["housing_type"] = v
    if v := _first(raw, "ConstructionMaterials"):
        mapped["construction_material"] = v
    if v := _first(raw, "StructuralStyle"):
        mapped["architectural_style"] = v

    if v := _first(raw, "SchoolDistrict"):
        mapped["school_district"] = v
    if v := _first(raw, "ElementarySchool", "ElementarySchoolName"):
        mapped["elementary_school"] = v
    if v := _first(raw, "MiddleSchoolName"):
        mapped["middle_school"] = v
        mapped["junior_high_school"] = v
    if v := _first(raw, "HighSchoolName"):
        mapped["high_school"] = v
        mapped["senior_high_school"] = v
    if v := _first(raw, "TaxLot"):
        mapped["lot"] = v
    if v := _first(raw, "TaxBlock"):
        mapped["tax_block"] = v

    if v := _first(raw, "BedroomsTotal"):
        mapped["bedrooms_total"] = v
    if v := _first(raw, "BathroomsFull"):
        mapped["bathrooms_full"] = v
    if v := _first(raw, "BathroomsHalf"):
        mapped["bathrooms_half"] = v
    if v := _first(raw, "Levels"):
        mapped["levels"] = v
    if v := _first(raw, "NumberOfLivingAreas"):
        mapped["living_areas"] = v
    if v := _first(raw, "NumberOfDiningAreas"):
        mapped["dining_areas"] = v

    if items := _split_list(raw, "InteriorFeatures"):
        mapped["interior_features"] = items
    if items := _split_list(raw, "Flooring"):
        mapped["flooring"] = items
    if v := _yn_to_yes_no(raw, "PoolYN"):
        mapped["pool_yn"] = v
    if items := _split_list(raw, "PoolFeatures"):
        mapped["pool_features"] = items
    if v := _yn_to_yes_no(raw, "BasementYN"):
        mapped["basement_yn"] = v
    if items := _split_list(raw, "FoundationDetails"):
        mapped["foundation"] = items
    if items := _split_list(raw, "Roof"):
        mapped["roof"] = items
    if items := _split_list(raw, "CommunityFeatures"):
        mapped["community_features"] = items
    if v := _first(raw, "FireplacesTotal"):
        mapped["fireplace_count"] = v
    if items := _split_list(raw, "Appliances"):
        mapped["appliances"] = items

    if v := _yn_to_yes_no(raw, "GarageYN"):
        mapped["garage_yn"] = v
    if v := _first(raw, "GarageSpaces"):
        mapped["garage_spaces"] = v
    if v := _first(raw, "CarportSpaces"):
        mapped["carport_spaces"] = v
    if v := _first(raw, "CoveredSpaces"):
        mapped["covered_spaces_total"] = v
    if items := _split_list(raw, "ParkingFeatures"):
        mapped["parking_features"] = items
    if v := _yn_to_yes_no(raw, "AttachedGarageYN"):
        mapped["attached_garage_yn"] = v

    if v := _first(raw, "LotSizeArea", "LotSizeSquareFeet"):
        mapped["lot_size_area"] = v
    if v := _first(raw, "LotSizeUnits"):
        mapped["lot_size_unit"] = v
    if items := _split_list(raw, "LotFeatures", "LotSize"):
        mapped["lot_features"] = items
    if v := _yn_to_yes_no(raw, "WaterfrontYN"):
        mapped["waterfront_yn"] = v
    if items := _split_list(raw, "Fencing"):
        mapped["fence_type"] = items

    if items := _split_list(raw, "Utilities"):
        mapped["utilities"] = items
    if items := _split_list(raw, "Heating"):
        mapped["heating"] = items
    if items := _split_list(raw, "Cooling"):
        mapped["cooling"] = items
    if v := _yn_to_yes_no(raw, "MunicipalUtilityDistrictYN"):
        mapped["mud_district_yn"] = v

    assoc_type = _first(raw, "AssociationType")
    if assoc_type:
        mapped["hoa_type"] = assoc_type
    elif _first(raw, "AssociationYN").lower() in ("0", "false", "no"):
        mapped["hoa_type"] = "None"
    if v := _strip_decimal_money(_first(raw, "AssociationFee")):
        mapped["hoa_dues"] = v
    if v := _first(raw, "AssociationFeeFrequency"):
        mapped["hoa_billing_frequency"] = v
    if v := _first(raw, "HOAManagementCompany"):
        mapped["hoa_management_company"] = v
    if v := _first(raw, "HOAManagementCompanyPhone"):
        mapped["hoa_management_phone"] = v
    if items := _split_list(raw, "AssociationFeeIncludes"):
        mapped["hoa_includes"] = items

    if v := _first(raw, "Possession"):
        mapped["possession"] = v
    if items := _split_list(raw, "ListingTerms", "BuyerFinancing"):
        mapped["listing_terms"] = items
    if v := _first(raw, "SpecialListingConditions"):
        mapped["special_listing_conditions"] = v
    if v := _first(raw, "Directions"):
        mapped["public_driving_directions"] = v
    if v := _first(raw, "PublicRemarks"):
        mapped["property_description"] = v
    if v := _first(raw, "PrivateRemarks"):
        mapped["private_remarks"] = v
    if v := _first(raw, "ShowingInstructions"):
        mapped["showing_instructions"] = v

    if v := _first(raw, "WillSubdivide"):
        mapped["will_subdivide_yn"] = v
    if v := _yn_to_yes_no(raw, "AccessoryUnitYN"):
        mapped["accessory_unit_yn"] = v
    if v := _first(raw, "AccessoryUnitSF"):
        mapped["accessory_unit_sqft"] = v
    if v := _first(raw, "AccessoryUnitType"):
        mapped["accessory_unit_type"] = v

    if v := _first(raw, "ListingId"):
        mapped["mls_number"] = v

    return {k: v for k, v in mapped.items() if v != "" and v != []}


class RETSService:
    """RETS login → search → logout per request (digest auth)."""

    def __init__(self, settings: Settings | None = None) -> None:
        self._settings = settings or get_settings()
        self.login_url = self._settings.ntreis_rets_url.strip()
        base = _rets_base_url(self.login_url) if self.login_url else ""
        self.search_url = f"{base}/Search.ashx" if base else ""
        self.metadata_url = f"{base}/GetMetadata.ashx" if base else ""
        self.username = self._settings.ntreis_rets_username.strip()
        self.password = self._settings.ntreis_rets_password
        self._client: httpx.AsyncClient | None = None

    @property
    def configured(self) -> bool:
        return bool(self.login_url and self.username and self.password)

    async def __aenter__(self) -> RETSService:
        if not self.configured:
            raise RuntimeError("NTREIS RETS credentials are not configured.")
        self._client = httpx.AsyncClient(
            auth=httpx.DigestAuth(self.username, self.password),
            headers={
                "User-Agent": RETS_USER_AGENT,
                "RETS-Version": RETS_VERSION,
                "Accept": "*/*",
            },
            follow_redirects=True,
            timeout=30.0,
        )
        await self._login()
        return self

    async def __aexit__(self, *args: object) -> None:
        await self._logout()
        if self._client:
            await self._client.aclose()
            self._client = None

    async def _login(self) -> None:
        assert self._client is not None
        response = await self._client.get(self.login_url)
        response.raise_for_status()

    async def _logout(self) -> None:
        if not self._client:
            return
        try:
            logout_url = self.login_url.replace("Login.ashx", "Logout.ashx")
            await self._client.get(logout_url)
        except httpx.HTTPError:
            logger.debug("RETS logout failed (non-critical)")

    async def search_by_mls_number(self, mls_number: str) -> dict[str, str] | None:
        queries = [
            f"(ListingId={mls_number})",
            f"(ListingKeyNumeric={mls_number})",
        ]
        for query in queries:
            result = await self._search_one(query)
            if result:
                return result
        return None

    async def search_by_address(
        self,
        street_number: str,
        street_name: str,
        city: str = "",
    ) -> list[dict[str, str]]:
        name = street_name.strip()
        # Clean trailing suffix: e.g. "Pecan Drive" -> "Pecan", "Pecan Dr" -> "Pecan"
        suffix_words = {
            "drive", "dr", "street", "st", "avenue", "ave", "road", "rd", 
            "court", "ct", "trail", "trl", "lane", "ln", "way", "loop", 
            "boulevard", "blvd", "circle", "cir", "parkway", "pkwy", 
            "place", "pl", "terrace", "ter"
        }
        words = name.split()
        if len(words) > 1 and words[-1].lower().rstrip(".") in suffix_words:
            name_without_suffix = " ".join(words[:-1])
        else:
            name_without_suffix = name

        queries = [
            f"(StreetNumber={street_number}),(StreetName={name})",
            f"(StreetNumber={street_number}),(StreetName=*{name}*)",
        ]
        
        if name_without_suffix != name:
            queries.append(f"(StreetNumber={street_number}),(StreetName={name_without_suffix})")
            queries.append(f"(StreetNumber={street_number}),(StreetName=*{name_without_suffix}*)")
        seen: set[str] = set()
        results: list[dict[str, str]] = []

        for query in queries:
            for row in await self._search_many(query, limit=15):
                key = row.get("ListingId") or row.get("ListingKeyNumeric", "")
                if key and key in seen:
                    continue
                if key:
                    seen.add(key)
                if city:
                    clean_city = city.split(",")[0].strip().lower()
                    row_city = row.get("City", "").strip().lower()
                    if row_city and row_city != clean_city:
                        continue
                results.append(row)
            if results:
                break

        return results

    async def discover_sample(self) -> dict[str, str] | None:
        rows = await self._search_many("(ListPrice=100000+)", limit=1)
        return rows[0] if rows else None

    async def _search_one(self, query: str) -> dict[str, str] | None:
        rows = await self._search_many(query, limit=1)
        return rows[0] if rows else None

    async def _search_many(self, query: str, limit: int = 10) -> list[dict[str, str]]:
        assert self._client is not None
        params = {
            "SearchType": "Property",
            "Class": RETS_PROPERTY_CLASS,
            "Query": query,
            "QueryType": "DMQL2",
            "Count": "1",
            "Format": "COMPACT-DECODED",
            "Limit": str(limit),
            "StandardNames": "0",
        }
        try:
            response = await self._client.get(self.search_url, params=params)
            response.raise_for_status()
            return self._parse_compact_response(response.text)
        except httpx.HTTPError as exc:
            logger.warning("RETS search failed for query %r: %s", query, exc)
            return []

    def _parse_compact_response(self, xml_text: str) -> list[dict[str, str]]:
        try:
            root = ET.fromstring(xml_text)
        except ET.ParseError:
            start = xml_text.find("<RETS")
            if start < 0:
                return []
            try:
                root = ET.fromstring(xml_text[start:])
            except ET.ParseError:
                return []

        reply_code = root.get("ReplyCode", "0")
        if reply_code not in ("0", "20201"):
            logger.info(
                "RETS reply %s: %s",
                reply_code,
                root.get("ReplyText", "Unknown"),
            )
            return []

        columns_el = root.find("COLUMNS")
        if columns_el is None or not columns_el.text:
            return []

        columns = columns_el.text.strip("\t").split("\t")
        results: list[dict[str, str]] = []

        for data_el in root.findall("DATA"):
            if not data_el.text:
                continue
            values = data_el.text.strip("\t").split("\t")
            row = {
                columns[i]: values[i] if i < len(values) else ""
                for i in range(len(columns))
            }
            results.append(row)

        return results
