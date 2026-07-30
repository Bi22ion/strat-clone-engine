#!/usr/bin/env python3
"""
Strat-Clone Engine - Behavioral Pattern Extraction Script
Processes parsed trade history and generates a serialized ruleset.
"""

import json
import sys
import os
from collections import Counter
from datetime import datetime

try:
    import psycopg2
    import pandas as pd
except ImportError:
    print(json.dumps({"error": "Install psycopg2-binary and pandas: pip install psycopg2-binary pandas"}))
    sys.exit(1)


def get_db_connection():
    return psycopg2.connect(os.environ.get("DATABASE_URL"))


def extract_patterns(trades_df):
    total = len(trades_df)
    if total == 0:
        raise ValueError("No trades to analyze")

    wins = trades_df[trades_df["pnl"] > 0]
    losses = trades_df[trades_df["pnl"] <= 0]
    win_rate = (len(wins) / total) * 100

    avg_win = wins["pnl"].abs().mean() if len(wins) > 0 else 0
    avg_loss = losses["pnl"].abs().mean() if len(losses) > 0 else 1
    avg_risk_reward = avg_win / avg_loss if avg_loss > 0 else avg_win

    avg_duration = int(trades_df["duration_minutes"].mean()) if "duration_minutes" in trades_df else 0

    asset_counts = trades_df["asset_class"].value_counts().to_dict() if "asset_class" in trades_df else {}
    preferred_assets = [
        {"class": k, "count": int(v), "percentage": round(v / total * 100, 2)}
        for k, v in sorted(asset_counts.items(), key=lambda x: -x[1])
    ]

    symbol_counts = trades_df["symbol"].value_counts().head(5).to_dict()
    top_symbols = [{"symbol": k, "count": int(v)} for k, v in symbol_counts.items()]

    avg_entry = trades_df["entry_price"].mean()

    ruleset = {
        "version": "1.0",
        "type": "behavioral_clone",
        "generated_at": datetime.utcnow().isoformat(),
        "engine": "python_pandas",
        "entry_rules": {
            "preferred_symbols": list(symbol_counts.keys()),
            "preferred_asset_classes": [a["class"] for a in preferred_assets],
            "min_win_rate_threshold": max(win_rate - 10, 40),
            "price_range": {"min": avg_entry * 0.5, "max": avg_entry * 2},
        },
        "exit_rules": {
            "target_risk_reward": max(avg_risk_reward, 1.5),
            "max_hold_minutes": avg_duration * 2 or 480,
            "stop_loss_multiplier": 1 / max(avg_risk_reward, 1),
        },
        "risk_management": {
            "max_position_size_pct": 5,
            "max_daily_trades": min(int(total / 30) + 1, 10),
            "confidence_threshold": win_rate / 100,
        },
        "behavioral_signature": {
            "win_rate": round(win_rate, 2),
            "avg_risk_reward": round(avg_risk_reward, 4),
            "trade_frequency": total,
            "dominant_side": "long" if "side" in trades_df and (trades_df["side"] == "buy").sum() > total / 2 else "mixed",
        },
    }

    return {
        "win_rate": round(win_rate, 2),
        "avg_risk_reward": round(avg_risk_reward, 4),
        "avg_trade_duration_minutes": avg_duration,
        "preferred_asset_classes": preferred_assets,
        "top_symbols": top_symbols,
        "total_trades": total,
        "ruleset": ruleset,
    }


def main():
    if len(sys.argv) < 4:
        print(json.dumps({"error": "Usage: train_model.py <dataset_id> <user_id> <model_name>"}))
        sys.exit(1)

    dataset_id, user_id, model_name = sys.argv[1], sys.argv[2], sys.argv[3]

    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute(
        "SELECT * FROM parsed_trades WHERE dataset_id = %s AND user_id = %s ORDER BY timestamp",
        (dataset_id, user_id),
    )
    columns = [desc[0] for desc in cur.description]
    rows = cur.fetchall()

    if not rows:
        print(json.dumps({"error": "No parsed trades found"}))
        sys.exit(1)

    df = pd.DataFrame(rows, columns=columns)
    for col in ["pnl", "entry_price", "exit_price"]:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    metrics = extract_patterns(df)

    cur.execute(
        """INSERT INTO strategy_models (user_id, dataset_id, name, status, win_rate, avg_risk_reward,
           avg_trade_duration_minutes, preferred_asset_classes, ruleset, metrics)
           VALUES (%s, %s, %s, 'ready', %s, %s, %s, %s, %s, %s) RETURNING id""",
        (
            user_id, dataset_id, model_name,
            metrics["win_rate"], metrics["avg_risk_reward"],
            metrics["avg_trade_duration_minutes"],
            json.dumps(metrics["preferred_asset_classes"]),
            json.dumps(metrics["ruleset"]),
            json.dumps(metrics),
        ),
    )
    model_id = cur.fetchone()[0]
    conn.commit()
    cur.close()
    conn.close()

    print(json.dumps({"success": True, "model_id": str(model_id), "metrics": metrics}))


if __name__ == "__main__":
    main()
