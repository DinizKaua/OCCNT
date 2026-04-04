from __future__ import annotations

import csv
import math
import tempfile
import unittest
from pathlib import Path
from statistics import mean

from app.services.prediction_engine import generate_forecast


def _write_tidy_csv(path: Path, rows: list[dict[str, object]]) -> None:
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "sistema",
                "uf_sigla",
                "uf_codigo",
                "uf_nome",
                "granularidade",
                "filtro_cid",
                "periodo",
                "valor",
            ],
            delimiter=";",
        )
        writer.writeheader()
        writer.writerows(rows)


class PredictionEngineValidationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.temp_dir = tempfile.TemporaryDirectory()
        base_path = Path(cls.temp_dir.name)

        cls.annual_trailing_zero_path = base_path / "annual_trailing_zero.csv"
        annual_trailing_zero_rows = [
            {"sistema": "SIM-DO", "uf_sigla": "MA", "uf_codigo": "21", "uf_nome": "Maranhao", "granularidade": "annual", "filtro_cid": "I10", "periodo": year, "valor": value}
            for year, value in [
                (2019, 1871),
                (2020, 2279),
                (2021, 1994),
                (2022, 1960),
                (2023, 1902),
                (2024, 2000),
                (2025, 0),
            ]
        ]
        _write_tidy_csv(cls.annual_trailing_zero_path, annual_trailing_zero_rows)

        cls.annual_dense_path = base_path / "annual_dense.csv"
        annual_dense_rows = [
            {"sistema": "SIM-DO", "uf_sigla": "MA", "uf_codigo": "21", "uf_nome": "Maranhao", "granularidade": "annual", "filtro_cid": "I10", "periodo": year, "valor": value}
            for year, value in [
                (2012, 1450),
                (2013, 1515),
                (2014, 1605),
                (2015, 1690),
                (2016, 1750),
                (2017, 1830),
                (2018, 1905),
                (2019, 1980),
                (2020, 2075),
                (2021, 2140),
                (2022, 2235),
                (2023, 2310),
                (2024, 2395),
            ]
        ]
        _write_tidy_csv(cls.annual_dense_path, annual_dense_rows)

        cls.monthly_path = base_path / "monthly.csv"
        monthly_rows = []
        seasonal_pattern = [18, 12, 16, 10, 8, 6, 9, 11, 14, 20, 24, 28]
        for year in range(2022, 2026):
            for month in range(1, 13):
                offset = (year - 2022) * 12 + (month - 1)
                value = 140 + offset * 1.8 + seasonal_pattern[month - 1]
                monthly_rows.append(
                    {
                        "sistema": "SIM-DO",
                        "uf_sigla": "MA",
                        "uf_codigo": "21",
                        "uf_nome": "Maranhao",
                        "granularidade": "monthly",
                        "filtro_cid": "I10",
                        "periodo": f"{year}/{['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][month - 1]}",
                        "valor": round(value, 2),
                    }
                )
        _write_tidy_csv(cls.monthly_path, monthly_rows)

    @classmethod
    def tearDownClass(cls) -> None:
        cls.temp_dir.cleanup()

    def test_annual_forecast_ignores_unavailable_trailing_year(self) -> None:
        for model in ("arima", "theta"):
            with self.subTest(model=model):
                result = generate_forecast(
                    dataset_path=self.annual_trailing_zero_path,
                    state="MA",
                    mode="annual",
                    model=model,
                    forecast_years=4,
                    confidence=0.95,
                )
                self.assertEqual(result["historical_data"][-1]["year"], 2024)
                self.assertEqual(result["historical_data"][-1]["value"], 2000.0)
                self.assertEqual(result["forecast"][0]["year"], 2025)

    def test_annual_models_return_reasonable_values(self) -> None:
        for model in ("arima", "theta"):
            with self.subTest(model=model):
                result = generate_forecast(
                    dataset_path=self.annual_dense_path,
                    state="MA",
                    mode="annual",
                    model=model,
                    forecast_years=4,
                    confidence=0.95,
                )
                history_max = max(item["value"] for item in result["historical_data"])
                values = [item["value"] for item in result["forecast"]]
                self.assertTrue(all(math.isfinite(value) and value > 0 for value in values))
                self.assertTrue(max(values) < history_max * 2.5)
                for item in result["forecast"]:
                    self.assertLessEqual(item["lower"], item["value"])
                    self.assertGreaterEqual(item["upper"], item["value"])

    def test_monthly_models_generate_contiguous_future_periods(self) -> None:
        for model in ("arima", "theta"):
            with self.subTest(model=model):
                result = generate_forecast(
                    dataset_path=self.monthly_path,
                    state="MA",
                    mode="monthly",
                    model=model,
                    forecast_periods=6,
                    confidence=0.95,
                )
                self.assertEqual(result["historical_data"][-1]["month"], "2025-12")
                self.assertEqual(result["forecast"][0]["month"], "2026-01")
                self.assertEqual(len(result["forecast"]), 6)
                for item in result["forecast"]:
                    self.assertTrue(math.isfinite(item["value"]) and item["value"] > 0)
                    self.assertLessEqual(item["lower"], item["value"])
                    self.assertGreaterEqual(item["upper"], item["value"])

    def test_model_labels_remain_identifiable(self) -> None:
        for model in ("arima", "theta"):
            with self.subTest(model=model):
                result = generate_forecast(
                    dataset_path=self.annual_dense_path,
                    state="MA",
                    mode="annual",
                    model=model,
                    forecast_years=2,
                    confidence=0.95,
                )
                expected_label = "ARIMA" if model == "arima" else "Theta"
                self.assertIn(expected_label, result["model"])

    def test_backtest_metrics_stay_in_reasonable_range(self) -> None:
        for model in ("arima", "theta"):
            with self.subTest(model=model):
                annual_mae = self._rolling_mae(
                    path=self.annual_dense_path,
                    model=model,
                    mode="annual",
                    cutoffs=(10, 11, 12),
                    horizon_key="forecast_years",
                    horizon_value=1,
                )
                monthly_mae = self._rolling_mae(
                    path=self.monthly_path,
                    model=model,
                    mode="monthly",
                    cutoffs=(42, 43, 44),
                    horizon_key="forecast_periods",
                    horizon_value=1,
                )
                self.assertLess(annual_mae, 60.0)
                self.assertLess(monthly_mae, 20.0)

    def _rolling_mae(
        self,
        path: Path,
        model: str,
        mode: str,
        cutoffs: tuple[int, ...],
        horizon_key: str,
        horizon_value: int,
    ) -> float:
        rows = self._read_rows(path)
        errors = []
        with tempfile.TemporaryDirectory() as temp_dir:
            base = Path(temp_dir)
            for cutoff in cutoffs:
                train_rows = rows[:cutoff]
                actual = float(rows[cutoff]["valor"])
                train_path = base / f"{mode}_{model}_{cutoff}.csv"
                _write_tidy_csv(train_path, train_rows)
                payload = {
                    "dataset_path": train_path,
                    "state": "MA",
                    "mode": mode,
                    "model": model,
                    "confidence": 0.95,
                    horizon_key: horizon_value,
                }
                result = generate_forecast(**payload)
                errors.append(abs(float(result["forecast"][0]["value"]) - actual))
        return mean(errors)

    def _read_rows(self, path: Path) -> list[dict[str, str]]:
        with path.open("r", encoding="utf-8", newline="") as handle:
            reader = csv.DictReader(handle, delimiter=";")
            return [dict(row) for row in reader]


if __name__ == "__main__":
    unittest.main()
