from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.services.prediction_engine import generate_forecast  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description="Run forecast from a CSV dataset.")
    parser.add_argument("--csv", required=True, help="CSV file path")
    parser.add_argument("--state", default="21", help="UF code, sigla or name")
    parser.add_argument("--mode", default="auto", choices=["auto", "annual", "monthly"])
    parser.add_argument("--model", default="arima", choices=["arima", "theta"])
    parser.add_argument("--forecast-years", type=int, default=3)
    parser.add_argument("--forecast-periods", type=int, default=12)
    parser.add_argument("--confidence", type=float, default=0.95)
    parser.add_argument("--seasonal", choices=["auto", "true", "false"], default="auto")
    parser.add_argument("--output", default="-", help="Output JSON file path, or '-' to print")
    parser.add_argument("--pretty", action="store_true")
    args = parser.parse_args()

    seasonal_value = None
    if args.seasonal == "true":
        seasonal_value = True
    elif args.seasonal == "false":
        seasonal_value = False

    payload = generate_forecast(
        dataset_path=Path(args.csv).resolve(),
        state=args.state,
        mode=args.mode,
        model=args.model,
        forecast_years=args.forecast_years,
        forecast_periods=args.forecast_periods,
        confidence=args.confidence,
        seasonal=seasonal_value,
    )

    json_payload = json.dumps(payload, ensure_ascii=False, indent=2 if args.pretty else None)
    if args.output == "-":
        print(json_payload)
        return

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json_payload, encoding="utf-8")


if __name__ == "__main__":
    main()

