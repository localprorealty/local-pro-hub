import unittest
from datetime import date
from services.revenue_share import (
    get_cap_cycle_start,
    get_anniversary_in_year
)

class TestRevenueShare(unittest.TestCase):
    def test_get_anniversary_in_year_normal(self):
        base = date(2023, 11, 15)
        self.assertEqual(get_anniversary_in_year(base, 2026), date(2026, 11, 15))

    def test_get_anniversary_in_year_leap(self):
        base = date(2024, 2, 29)
        self.assertEqual(get_anniversary_in_year(base, 2025), date(2025, 2, 28))

    def test_get_cap_cycle_start_passed(self):
        # Anniversary is Nov 15. Closed is Dec 10, 2026.
        # Cycle start should be Nov 15, 2026.
        cycle_start = get_cap_cycle_start("2023-11-15", None, date(2026, 12, 10))
        self.assertEqual(cycle_start, date(2026, 11, 15))

    def test_get_cap_cycle_start_not_passed(self):
        # Anniversary is Nov 15. Closed is July 10, 2026.
        # Cycle start should be Nov 15, 2025.
        cycle_start = get_cap_cycle_start("2023-11-15", None, date(2026, 7, 10))
        self.assertEqual(cycle_start, date(2025, 11, 15))

if __name__ == "__main__":
    unittest.main()
